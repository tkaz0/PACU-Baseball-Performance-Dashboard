-- One reviewed Full Swing publication owns all numerical projections for its file.
-- Original CSVs and export-player names are never stored in this private ledger.
create table private.full_swing_publications (
  file_hash text primary key check (file_hash ~ '^[a-f0-9]{64}$'),
  revision integer not null check (revision > 0),
  payload jsonb not null,
  receipt jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table private.full_swing_publication_revisions (
  file_hash text not null references private.full_swing_publications(file_hash),
  revision integer not null check (revision > 0),
  payload jsonb not null,
  projection jsonb not null,
  receipt jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(file_hash,revision)
);
create table private.full_swing_publication_requests (
  request_id uuid primary key,
  signature jsonb not null,
  receipt jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table private.full_swing_publications enable row level security;
alter table private.full_swing_publication_revisions enable row level security;
alter table private.full_swing_publication_requests enable row level security;
revoke all on private.full_swing_publications,private.full_swing_publication_revisions,private.full_swing_publication_requests from public,anon,authenticated;

create function private.full_swing_projection(p_hash text) returns jsonb
language sql stable security definer set search_path='' set extra_float_digits=3 as $$
  select jsonb_build_object(
    'measurements',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.performance_measurements m where m.file_hash=p_hash),'[]'::jsonb),
    'samples',coalesce((select jsonb_agg(to_jsonb(s) order by s.athlete_id,s.metric_key,s.unit) from private.full_swing_session_samples s where s.file_hash=p_hash),'[]'::jsonb),
    'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.source_row) from public.full_swing_contacts c where c.file_hash=p_hash),'[]'::jsonb),
    'labels',coalesce((select jsonb_build_object('version',a.version,'assignments',a.assignments) from private.full_swing_pitch_assignments a where a.file_hash=p_hash),jsonb_build_object('version',0,'assignments','[]'::jsonb))
  )
$$;

create function private.validate_full_swing_publication(p jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb; m jsonb; position jsonb; prefix text; metric_position integer; pitch_position integer;
  fields text[]:=array['assignmentVersion','assignments','category','contacts','date','eventCount','excludedPlayerCount','fileHash','fileName','measurements','mode','removedValues','samples','unresolvedPitchCount'];
  summary_metrics text[]:=array['max_exit_velocity','avg_exit_velocity','max_bat_speed','avg_bat_speed','max_distance','max_pitch_velocity','avg_pitch_velocity'];
  pitch_metrics text[]:=array['classified_max_velocity','classified_avg_velocity','classified_max_spin','classified_avg_spin','classified_pitch_count','classified_velocity_count','classified_spin_count'];
  pitch_types text[]:=array['Fastball','Breaking Ball','Four-Seam Fastball','Two-Seam Fastball','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Splitter','Knuckleball','Other'];
begin
  if jsonb_typeof(p) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from fields
    or octet_length(p::text)>5242880 then raise exception 'Invalid Full Swing publication fields' using errcode='22023'; end if;
  if jsonb_typeof(p->'fileHash') is distinct from 'string' or p->>'fileHash' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p->'fileName') is distinct from 'string' or length(p->>'fileName') not between 1 and 300
    or p->>'fileName'<>btrim(p->>'fileName') or p->>'fileName' ~ '[[:cntrl:]]'
    or jsonb_typeof(p->'date') is distinct from 'string' or p->>'date' !~ '^2026-(09|10|11|12)-[0-9]{2}$'
    or (p->>'date')::date not between date '2026-09-01' and date '2026-12-31'
    or jsonb_typeof(p->'category') is distinct from 'string' or p->>'category' not in ('game','intrasquad','practice')
    or jsonb_typeof(p->'mode') is distinct from 'string' or p->>'mode' not in ('Live at Bat','Machine BP') then
    raise exception 'Review the original Full Swing file, date and session type' using errcode='22023';
  end if;
  for r in select jsonb_build_object('key',x) from unnest(array['eventCount','unresolvedPitchCount','excludedPlayerCount','assignmentVersion']) x loop
    if jsonb_typeof(p->(r->>'key')) is distinct from 'number' or p->>(r->>'key') !~ '^[0-9]{1,9}$' then
      raise exception 'Invalid publication count or version' using errcode='22023';
    end if;
  end loop;
  if (p->>'eventCount')::integer not between 1 and 5000 or (p->>'unresolvedPitchCount')::integer>(p->>'eventCount')::integer
    or (p->>'excludedPlayerCount')::integer>1000 then raise exception 'Invalid publication counts' using errcode='22023'; end if;
  for r in select jsonb_build_object('key',x) from unnest(array['measurements','samples','contacts','assignments','removedValues']) x loop
    if jsonb_typeof(p->(r->>'key')) is distinct from 'array' then raise exception 'Invalid publication review rows' using errcode='22023'; end if;
  end loop;
  if jsonb_array_length(p->'measurements') not between 1 and 2000 or jsonb_array_length(p->'samples')>500
    or jsonb_array_length(p->'contacts')>500 or jsonb_array_length(p->'assignments')>5000
    or jsonb_array_length(p->'removedValues')>35000 then raise exception 'Full Swing publication exceeds the reviewed limits' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p->'removedValues') v where jsonb_typeof(v)<>'string'
      or (v#>>'{}') !~ '^[0-9]{1,4}:(RelSpeed|SpinRate|ExitSpeed|Angle|Direction|BatSpeed|Distance)$'
      or split_part(v#>>'{}',':',1)::integer not between 2 and 5001)
    or (select count(distinct v) from jsonb_array_elements(p->'removedValues') v)<>jsonb_array_length(p->'removedValues') then
    raise exception 'Review each removed source cell' using errcode='22023';
  end if;
  if (select count(distinct v->>'observation_id') from jsonb_array_elements(p->'measurements') v)<>jsonb_array_length(p->'measurements')
    or (select count(distinct substring(v->>'observation_id' from 13)::jsonb) from jsonb_array_elements(p->'measurements') v)<>jsonb_array_length(p->'measurements')
    or (select count(distinct jsonb_build_array(v->>'athlete_code',v->>'metric_key',v->>'source',v->>'unit')) from jsonb_array_elements(p->'measurements') v)<>jsonb_array_length(p->'measurements') then
    raise exception 'Duplicate Full Swing observation coordinates' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p->'measurements') v group by v->>'source_sheet',v->>'source_row' having count(distinct v->>'athlete_code')<>1) then
    raise exception 'One source-summary row cannot belong to multiple athletes' using errcode='22023';
  end if;
  prefix:='Full Swing · '||case p->>'category' when 'game' then 'Game' when 'practice' then 'Practice' else 'Intrasquad' end;
  for m in select value from jsonb_array_elements(p->'measurements') loop
    if jsonb_typeof(m) is distinct from 'object' or m->>'file_hash' is distinct from p->>'fileHash'
      or m->>'source_file' is distinct from p->>'fileName' or m->>'measured_at' is distinct from p->>'date'
      or m->>'source_sheet' not in ('CSV · Full Swing session summaries v1','CSV · Classified pitch summaries v1') then
      raise exception 'Every measurement must belong to the reviewed Full Swing session' using errcode='22023';
    end if;
    position:=substring(m->>'observation_id' from 13)::jsonb;
    if m->>'source_sheet'='CSV · Full Swing session summaries v1' then
      metric_position:=array_position(summary_metrics,m->>'metric_key');
      if metric_position is null or m->>'source' is distinct from prefix or (position->>3)::integer<>metric_position+1
        or m->>'unit' is distinct from (case when m->>'metric_key'='max_distance' then 'ft' else 'mph' end) then
        raise exception 'Invalid session-summary source coordinate' using errcode='22023';
      end if;
      if (select count(*) from jsonb_array_elements(p->'samples') s where s->>'athleteCode'=m->>'athlete_code'
        and s->>'fileHash'=m->>'file_hash' and s->>'metricKey'=m->>'metric_key' and s->>'unit'=m->>'unit'
        and s->'sourceRow'=m->'source_row' and s->'expectedValue'=m->'value')<>1 then
        raise exception 'Every session summary needs its exact reviewed sample count' using errcode='22023';
      end if;
    else
      metric_position:=array_position(pitch_metrics,m->>'metric_key');
      pitch_position:=array_position(pitch_types,substring(m->>'source' from length(prefix)+4));
      if metric_position is null or pitch_position is null or left(m->>'source',length(prefix)+3)<>prefix||' · '
        or (position->>3)::integer<>(pitch_position-1)*7+metric_position-1
        or m->>'unit' is distinct from (case when metric_position<=2 then 'mph' when metric_position<=4 then 'rpm' else 'count' end) then
        raise exception 'Invalid classified-pitch source coordinate' using errcode='22023';
      end if;
      if not exists(select 1 from jsonb_array_elements(p->'assignments') a where a->>'pitchType'=pitch_types[pitch_position]) then
        raise exception 'Pitch results require reviewed pitch labels' using errcode='22023';
      end if;
    end if;
    if p->>'mode'='Machine BP' and (p->>'category'<>'practice' or m->>'source_sheet'='CSV · Classified pitch summaries v1'
      or m->>'metric_key' in ('max_pitch_velocity','avg_pitch_velocity')) then
      raise exception 'Machine BP publishes Practice hitting only' using errcode='22023';
    end if;
  end loop;
  if p->>'mode'='Machine BP' and (jsonb_array_length(p->'assignments')<>0 or (p->>'unresolvedPitchCount')::integer<>0) then
    raise exception 'Machine BP has no player pitch assignments' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p->'samples') loop
    if r->>'fileHash' is distinct from p->>'fileHash' or (r->>'sampleCount')::numeric>(p->>'eventCount')::integer or
      (select count(*) from jsonb_array_elements(p->'measurements') candidate where candidate->>'source_sheet'='CSV · Full Swing session summaries v1'
        and candidate->>'athlete_code'=r->>'athleteCode' and candidate->>'metric_key'=r->>'metricKey' and candidate->>'unit'=r->>'unit'
        and candidate->'source_row'=r->'sourceRow' and candidate->'value'=r->'expectedValue')<>1 then
      raise exception 'Sample counts must match the reviewed measurements' using errcode='22023';
    end if;
  end loop;
  for r in select value from jsonb_array_elements(p->'contacts') loop
    if r->>'fileHash' is distinct from p->>'fileHash' or r->>'sourceFile' is distinct from p->>'fileName'
      or r->>'playedOn' is distinct from p->>'date' or r->>'category' is distinct from p->>'category'
      or not exists(select 1 from jsonb_array_elements(p->'measurements') candidate where candidate->>'athlete_code'=r->>'athleteCode'
        and candidate->>'source_sheet'='CSV · Full Swing session summaries v1' and candidate->>'metric_key' in ('max_exit_velocity','avg_exit_velocity')) then
      raise exception 'Contact maps must belong to matched hitters in the reviewed session' using errcode='22023';
    end if;
  end loop;
  if (select count(distinct c->>'sourceRow') from jsonb_array_elements(p->'contacts') c)<>jsonb_array_length(p->'contacts')
    or (select count(distinct c->>'pitchNumber') from jsonb_array_elements(p->'contacts') c)<>jsonb_array_length(p->'contacts') then
    raise exception 'Duplicate contact coordinates' using errcode='22023';
  end if;
end $$;

-- An adopted legacy session must account for every currently saved projection.
create function private.check_full_swing_adoption(p jsonb,p_snapshot jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare old jsonb;
begin
  for old in select value from jsonb_array_elements(p_snapshot->'measurements') loop
    if not exists(select 1 from jsonb_array_elements(p->'measurements') m join public.athletes a on a.athlete_code=m->>'athlete_code'
      where old->>'athlete_id'=a.id::text and old->>'observation_id'=m->>'observation_id'
        and old->>'metric_key'=m->>'metric_key' and old->>'unit'=m->>'unit' and old->>'measured_at'=m->>'measured_at'
        and old->'value'=m->'value' and old->>'source'=m->>'source' and old->>'source_file'=m->>'source_file'
        and old->>'source_sheet'=m->>'source_sheet' and old->'source_row'=m->'source_row' and old->>'file_hash'=m->>'file_hash') then
      raise exception 'Previously saved session results differ or are missing from this review; no existing data was changed' using errcode='23505';
    end if;
  end loop;
  for old in select value from jsonb_array_elements(p_snapshot->'samples') loop
    if not exists(select 1 from jsonb_array_elements(p->'samples') s join public.athletes a on a.athlete_code=s->>'athleteCode'
      where old->>'athlete_id'=a.id::text and old->>'file_hash'=s->>'fileHash' and old->>'metric_key'=s->>'metricKey'
        and old->>'unit'=s->>'unit' and old->'source_row'=s->'sourceRow' and old->'sample_count'=s->'sampleCount') then
      raise exception 'Previously saved sample counts differ or are missing from this review' using errcode='23505';
    end if;
  end loop;
  for old in select value from jsonb_array_elements(p_snapshot->'contacts') loop
    if not exists(select 1 from jsonb_array_elements(p->'contacts') c join public.athletes a on a.athlete_code=c->>'athleteCode'
      where old->>'athlete_id'=a.id::text and old->>'file_hash'=c->>'fileHash' and old->'source_row'=c->'sourceRow'
        and old->'pitch_number'=c->'pitchNumber' and old->>'source_file'=c->>'sourceFile' and old->>'played_on'=c->>'playedOn'
        and old->>'category'=c->>'category' and old->'exit_velocity'=c->'exitVelocity' and old->'launch_angle'=c->'launchAngle'
        and (old->'direction'='null'::jsonb or (old->'direction'=c->'direction' and old->'distance'=c->'distance'))) then
      raise exception 'Previously saved contact-map readings differ or are missing from this review' using errcode='23505';
    end if;
  end loop;
end $$;

create function private.full_swing_publication_metadata(p private.full_swing_publications) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('fileHash',p.file_hash,'fileName',p.payload->>'fileName','date',p.payload->>'date',
    'category',p.payload->>'category','mode',p.payload->>'mode','eventCount',(p.payload->>'eventCount')::integer,
    'revision',p.revision,'measurementCount',jsonb_array_length(p.payload->'measurements'),'sampleCount',jsonb_array_length(p.payload->'samples'),
    'contactCount',jsonb_array_length(p.payload->'contacts'),'assignedCount',jsonb_array_length(p.payload->'assignments'),
    'unresolvedPitchCount',(p.payload->>'unresolvedPitchCount')::integer,'excludedPlayerCount',(p.payload->>'excludedPlayerCount')::integer,
    'removedValueCount',jsonb_array_length(p.payload->'removedValues'),'publishedAt',p.created_at,'lastUpdatedAt',p.updated_at,
    'fullyPublished',verified.current,'restoreTargetRevision',case when p.revision>1 and verified.current then p.revision-1 else null end)
  from (select exists(select 1 from private.full_swing_publication_revisions r where r.file_hash=p.file_hash
    and r.revision=p.revision and r.projection=private.full_swing_projection(p.file_hash)) as current) verified
$$;

create function public.staff_publish_full_swing_session(p_request_id uuid,p_expected_revision integer,p_payload jsonb,p_replace boolean default false)
returns jsonb language plpgsql security definer set search_path='' set extra_float_digits=3 as $$
declare stored private.full_swing_publications; prior private.full_swing_publication_requests; snapshot jsonb; signature jsonb;
  part jsonb; result jsonb; measurements jsonb:=jsonb_build_object('created',0,'unchanged',0);
  samples jsonb:=jsonb_build_object('created',0,'unchanged',0); contacts jsonb:=jsonb_build_object('created',0,'unchanged',0,'spatial_enriched',0);
  labels jsonb; receipt jsonb; next_revision integer; stamp timestamptz:=clock_timestamp(); r jsonb; old jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff access required' using errcode='42501'; end if;
  if p_replace is true and not private.has_role('admin') then raise exception 'Active administrator required for session corrections' using errcode='42501'; end if;
  if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_replace is null then
    raise exception 'Review this session and its current revision' using errcode='22023'; end if;
  signature:=jsonb_build_object('operation','publish','expectedRevision',p_expected_revision,'replace',p_replace,'payload',p_payload);
  select * into prior from private.full_swing_publication_requests where request_id=p_request_id;
  if prior.request_id is not null then
    if prior.signature is distinct from signature then raise exception 'Publication request was already used for a different review' using errcode='23505'; end if;
    return prior.receipt;
  end if;
  perform private.validate_full_swing_publication(p_payload);
  select * into stored from private.full_swing_publications where file_hash=p_payload->>'fileHash' for update;
  if coalesce(stored.revision,0)<>p_expected_revision then raise exception 'Session changed; reload before publishing' using errcode='40001'; end if;
  snapshot:=private.full_swing_projection(p_payload->>'fileHash');
  if stored.file_hash is not null then
    if not exists(select 1 from private.full_swing_publication_revisions history where history.file_hash=stored.file_hash and history.revision=stored.revision and history.projection=snapshot) then
      raise exception 'Saved session results changed outside this review; reload and review the saved corrections' using errcode='40001';
    end if;
    if exists(select 1 from unnest(array['fileHash','fileName','date','category','mode','eventCount']) k where stored.payload->k is distinct from p_payload->k) then
      raise exception 'A publication cannot change its original file or session context' using errcode='23505';
    end if;
  elsif p_replace then raise exception 'Publish the reviewed original session before correcting it' using errcode='22023'; end if;
  if (snapshot->'labels'->>'version')::integer<>(p_payload->>'assignmentVersion')::integer then
    raise exception 'Pitch labels changed; reopen this session before publishing' using errcode='40001';
  end if;
  if p_replace then
    -- Every historical source coordinate keeps its original athlete/date/source ownership.
    for r in select value from jsonb_array_elements(p_payload->'measurements') loop
      if exists(select 1 from private.full_swing_publication_revisions h cross join lateral jsonb_array_elements(h.projection->'measurements') m
        join public.athletes a on a.id=(m->>'athlete_id')::uuid
        where h.file_hash=stored.file_hash and m->>'source_sheet'=r->>'source_sheet' and m->'source_row'=r->'source_row'
          and (a.athlete_code<>r->>'athlete_code' or (m->>'observation_id'=r->>'observation_id'
            and (m->>'metric_key'<>r->>'metric_key' or m->>'unit'<>r->>'unit' or m->>'source'<>r->>'source' or m->>'measured_at'<>r->>'measured_at')))) then
        raise exception 'A correction cannot move a source coordinate to another player or metric' using errcode='23505';
      end if;
    end loop;
    for r in select value from jsonb_array_elements(p_payload->'contacts') loop
      if exists(select 1 from private.full_swing_publication_revisions h cross join lateral jsonb_array_elements(h.projection->'contacts') c
        join public.athletes a on a.id=(c->>'athlete_id')::uuid where h.file_hash=stored.file_hash and c->'source_row'=r->'sourceRow'
          and (a.athlete_code<>r->>'athleteCode' or c->'pitch_number'<>r->'pitchNumber')) then
        raise exception 'A correction cannot move a contact to another player or pitch' using errcode='23505';
      end if;
    end loop;
    delete from public.full_swing_contacts where file_hash=stored.file_hash;
    delete from private.full_swing_session_samples where file_hash=stored.file_hash;
    delete from public.performance_measurements where file_hash=stored.file_hash;
  else
    perform private.check_full_swing_adoption(p_payload,snapshot);
  end if;
  labels:=private.full_swing_pitch_labels(p_payload->>'fileHash',(p_payload->>'assignmentVersion')::integer,p_payload->'assignments');
  -- Chunks retain the established canonical validator while sharing this transaction.
  for part in select jsonb_agg(value order by ordinal) from jsonb_array_elements(p_payload->'measurements') with ordinality x(value,ordinal) group by (ordinal-1)/500 order by (ordinal-1)/500 loop
    result:=private.import_performance(part);
    measurements:=jsonb_build_object('created',(measurements->>'created')::integer+(result->>'created')::integer,
      'unchanged',(measurements->>'unchanged')::integer+(result->>'unchanged')::integer);
  end loop;
  if jsonb_array_length(p_payload->'samples')>0 then samples:=public.save_full_swing_session_samples(p_payload->'samples'); end if;
  if jsonb_array_length(p_payload->'contacts')>0 then contacts:=private.import_full_swing_contacts(p_payload->'contacts'); end if;
  next_revision:=coalesce(stored.revision,0)+1;
  receipt:=jsonb_build_object('requestId',p_request_id,'fileHash',p_payload->>'fileHash','revision',next_revision,
    'created',(measurements->>'created')::integer,'unchanged',(measurements->>'unchanged')::integer,
    'measurementCount',jsonb_array_length(p_payload->'measurements'),'sampleCount',jsonb_array_length(p_payload->'samples'),
    'contactCount',jsonb_array_length(p_payload->'contacts'),'publishedAt',stamp,'measurements',measurements,'samples',samples,
    'contacts',jsonb_build_object('created',(contacts->>'created')::integer,'unchanged',(contacts->>'unchanged')::integer,'spatialEnriched',(contacts->>'spatial_enriched')::integer),
    'assignedCount',jsonb_array_length(p_payload->'assignments'),'assignmentVersion',(labels->>'version')::integer,
    'unresolvedPitchCount',(p_payload->>'unresolvedPitchCount')::integer,'excludedPlayerCount',(p_payload->>'excludedPlayerCount')::integer,
    'removedValueCount',jsonb_array_length(p_payload->'removedValues'),'fullyPublished',true,'restoredFromRevision',null);
  insert into private.full_swing_publications(file_hash,revision,payload,receipt,created_by,created_at,updated_by,updated_at)
    values(p_payload->>'fileHash',next_revision,p_payload,receipt,auth.uid(),stamp,auth.uid(),stamp)
    on conflict(file_hash) do update set revision=excluded.revision,payload=excluded.payload,receipt=excluded.receipt,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  insert into private.full_swing_publication_revisions(file_hash,revision,payload,projection,receipt,actor_id,created_at)
    values(p_payload->>'fileHash',next_revision,p_payload,private.full_swing_projection(p_payload->>'fileHash'),receipt,auth.uid(),stamp);
  insert into private.full_swing_publication_requests(request_id,signature,receipt,actor_id) values(p_request_id,signature,receipt,auth.uid());
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),case when p_replace then 'full_swing_session_corrected' else 'full_swing_session_published' end,p_request_id,
    jsonb_build_object('revision',next_revision,'measurementCount',jsonb_array_length(p_payload->'measurements'),'contactCount',jsonb_array_length(p_payload->'contacts'),'removedValueCount',jsonb_array_length(p_payload->'removedValues')));
  return receipt;
end $$;

create function public.admin_restore_full_swing_session(p_request_id uuid,p_file_hash text,p_expected_revision integer,p_target_revision integer)
returns jsonb language plpgsql security definer set search_path='' set extra_float_digits=3 as $$
declare stored private.full_swing_publications; target private.full_swing_publication_revisions;
  prior private.full_swing_publication_requests; signature jsonb; snapshot jsonb; labels jsonb; restore_receipt jsonb; stamp timestamptz:=clock_timestamp(); next_revision integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required for session restore' using errcode='42501'; end if;
  if p_request_id is null or p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or p_expected_revision is null or p_expected_revision<1
    or p_target_revision is null or p_target_revision<1 or p_target_revision>=p_expected_revision then
    raise exception 'Review the session and earlier revision to restore' using errcode='22023'; end if;
  signature:=jsonb_build_object('operation','restore','fileHash',p_file_hash,'expectedRevision',p_expected_revision,'targetRevision',p_target_revision);
  select * into prior from private.full_swing_publication_requests where request_id=p_request_id;
  if prior.request_id is not null then
    if prior.signature is distinct from signature then raise exception 'Publication request was already used for a different review' using errcode='23505'; end if;
    return prior.receipt;
  end if;
  select * into stored from private.full_swing_publications where file_hash=p_file_hash for update;
  if stored.file_hash is null or stored.revision<>p_expected_revision then raise exception 'Session changed; reload before restoring' using errcode='40001'; end if;
  snapshot:=private.full_swing_projection(p_file_hash);
  if not exists(select 1 from private.full_swing_publication_revisions r where r.file_hash=p_file_hash and r.revision=stored.revision and r.projection=snapshot) then
    raise exception 'Saved session results changed outside this review; review the saved corrections before restoring' using errcode='40001'; end if;
  select * into target from private.full_swing_publication_revisions where file_hash=p_file_hash and revision=p_target_revision;
  if target.file_hash is null then raise exception 'The reviewed session revision is unavailable' using errcode='22023'; end if;
  labels:=private.full_swing_pitch_labels(p_file_hash,(snapshot->'labels'->>'version')::integer,target.projection->'labels'->'assignments');
  delete from public.full_swing_contacts where file_hash=p_file_hash;
  delete from private.full_swing_session_samples where file_hash=p_file_hash;
  delete from public.performance_measurements where file_hash=p_file_hash;
  -- Ordinary insert triggers still reject any separately archived coordinates.
  insert into public.performance_measurements select * from jsonb_populate_recordset(null::public.performance_measurements,target.projection->'measurements');
  insert into private.full_swing_session_samples select * from jsonb_populate_recordset(null::private.full_swing_session_samples,target.projection->'samples');
  insert into public.full_swing_contacts select * from jsonb_populate_recordset(null::public.full_swing_contacts,target.projection->'contacts');
  next_revision:=stored.revision+1;
  restore_receipt:=jsonb_build_object('requestId',p_request_id,'fileHash',p_file_hash,'revision',next_revision,
    'created',jsonb_array_length(target.payload->'measurements'),'unchanged',0,
    'measurementCount',jsonb_array_length(target.payload->'measurements'),'sampleCount',jsonb_array_length(target.payload->'samples'),
    'contactCount',jsonb_array_length(target.payload->'contacts'),'publishedAt',stamp,
    'measurements',jsonb_build_object('created',jsonb_array_length(target.payload->'measurements'),'unchanged',0),
    'samples',jsonb_build_object('created',jsonb_array_length(target.payload->'samples'),'unchanged',0),
    'contacts',jsonb_build_object('created',jsonb_array_length(target.payload->'contacts'),'unchanged',0,'spatialEnriched',0),
    'assignedCount',jsonb_array_length(target.payload->'assignments'),'assignmentVersion',(labels->>'version')::integer,
    'unresolvedPitchCount',(target.payload->>'unresolvedPitchCount')::integer,'excludedPlayerCount',(target.payload->>'excludedPlayerCount')::integer,
    'removedValueCount',jsonb_array_length(target.payload->'removedValues'),'fullyPublished',true,'restoredFromRevision',p_target_revision);
  update private.full_swing_publications set revision=next_revision,payload=target.payload,receipt=restore_receipt,updated_by=auth.uid(),updated_at=stamp where file_hash=p_file_hash;
  insert into private.full_swing_publication_revisions(file_hash,revision,payload,projection,receipt,actor_id,created_at)
    values(p_file_hash,next_revision,target.payload,private.full_swing_projection(p_file_hash),restore_receipt,auth.uid(),stamp);
  insert into private.full_swing_publication_requests(request_id,signature,receipt,actor_id) values(p_request_id,signature,restore_receipt,auth.uid());
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'full_swing_session_restored',p_request_id,jsonb_build_object('revision',next_revision,'restoredFromRevision',p_target_revision,'measurementCount',jsonb_array_length(target.payload->'measurements')));
  return restore_receipt;
end $$;

create function public.staff_full_swing_session_publications() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff access required' using errcode='42501'; end if;
  if (select count(*) from private.full_swing_publications)>1000 then raise exception 'Session library exceeds the supported size' using errcode='22023'; end if;
  select coalesce(jsonb_agg(private.full_swing_publication_metadata(p) order by p.payload->>'date' desc,p.updated_at desc,p.file_hash),'[]'::jsonb) into result from private.full_swing_publications p;
  return result;
end $$;
create function public.staff_full_swing_session_state(p_file_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare stored private.full_swing_publications;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff access required' using errcode='42501'; end if;
  if p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid session fingerprint' using errcode='22023'; end if;
  select * into stored from private.full_swing_publications where file_hash=p_file_hash;
  return jsonb_build_object('revision',coalesce(stored.revision,0),'receipt',stored.receipt,
    'metadata',case when stored.file_hash is not null then private.full_swing_publication_metadata(stored) else null end,
    'publishedAt',stored.receipt->>'publishedAt',
    'removedValues',coalesce(stored.payload->'removedValues','[]'::jsonb),
    'fileName',stored.payload->>'fileName','date',stored.payload->>'date','category',stored.payload->>'category','mode',stored.payload->>'mode');
end $$;

revoke all on function private.full_swing_projection(text),private.validate_full_swing_publication(jsonb),private.check_full_swing_adoption(jsonb,jsonb),private.full_swing_publication_metadata(private.full_swing_publications) from public,anon,authenticated;
revoke all on function public.staff_publish_full_swing_session(uuid,integer,jsonb,boolean),public.admin_restore_full_swing_session(uuid,text,integer,integer),public.staff_full_swing_session_publications(),public.staff_full_swing_session_state(text) from public,anon,authenticated;
grant execute on function public.staff_publish_full_swing_session(uuid,integer,jsonb,boolean),public.admin_restore_full_swing_session(uuid,text,integer,integer),public.staff_full_swing_session_publications(),public.staff_full_swing_session_state(text) to authenticated;
