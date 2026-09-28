-- An explicit original-CSV review may correct one complete legacy generic group.
-- No source files, player names or CSV identity strings are stored here.
begin;
create table private.legacy_pitch_reclassifications (
  request_id uuid primary key,
  sequence bigint generated always as identity unique,
  athlete_id uuid not null references public.athletes(id),
  file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
  source_rows integer[] not null,
  before_measurements jsonb not null,
  after_measurements jsonb not null,
  before_labels jsonb not null,
  after_labels jsonb not null,
  before_fingerprint text not null check(before_fingerprint ~ '^[a-f0-9]{64}$'),
  after_fingerprint text not null check(after_fingerprint ~ '^[a-f0-9]{64}$'),
  receipt jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  restored_by uuid references auth.users(id),
  restored_at timestamptz
);
create table private.legacy_pitch_reclassification_requests (
  request_id uuid primary key,
  signature jsonb not null,
  receipt jsonb not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index legacy_pitch_reclassification_file on private.legacy_pitch_reclassifications(file_hash,athlete_id,sequence desc);
alter table private.legacy_pitch_reclassifications enable row level security;
alter table private.legacy_pitch_reclassification_requests enable row level security;
revoke all on private.legacy_pitch_reclassifications,private.legacy_pitch_reclassification_requests from public,anon,authenticated;

create function private.legacy_pitch_file_fingerprint(p_hash text) returns text
language sql stable security definer set search_path='' set extra_float_digits=3 as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'projection',private.full_swing_projection(p_hash),
    'labels',coalesce((select to_jsonb(a) from private.full_swing_pitch_assignments a where a.file_hash=p_hash),'null'::jsonb),
    'archives',coalesce((select jsonb_agg(to_jsonb(a) order by a.request_id) from private.csv_measurement_archives a where a.file_hash=p_hash),'[]'::jsonb),
    'publication',coalesce((select to_jsonb(p) from private.full_swing_publications p where p.file_hash=p_hash),'null'::jsonb)
  )::text,'UTF8')),'hex')
$$;

-- Null means this legacy group cannot be safely changed through this narrow path.
create function private.legacy_fastball_group(p_athlete uuid,p_hash text) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare rows jsonb; item jsonb; position jsonb; label_state private.full_swing_pitch_assignments;
  keys text[]:=array['classified_max_velocity','classified_avg_velocity','classified_max_spin','classified_avg_spin','classified_pitch_count','classified_velocity_count','classified_spin_count'];
  names text[]:=array['Pitch Type Max Velocity','Pitch Type Average Velocity','Pitch Type Max Spin','Pitch Type Average Spin','Pitch Type Count','Pitch Type Velocity Readings','Pitch Type Spin Readings'];
  i integer; pitches integer; velocity_count integer; spin_count integer; group_source text; date_value text; row_value integer; file_name text;
begin
  if p_athlete is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or exists(select 1 from private.full_swing_publications where file_hash=p_hash)
    or exists(select 1 from private.csv_measurement_archives where file_hash=p_hash and restored_at is null)
    or exists(select 1 from public.performance_measurements where athlete_id=p_athlete and file_hash=p_hash
      and source ~ '^Full Swing · (Game|Intrasquad|Practice) · Four-Seam Fastball$') then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.source_column),'[]'::jsonb) into rows
    from public.performance_measurements m where m.athlete_id=p_athlete and m.file_hash=p_hash
      and m.source ~ '^Full Swing · (Game|Intrasquad|Practice) · Fastball$';
  if jsonb_array_length(rows)<>7 then return null; end if;
  group_source:=rows->0->>'source'; date_value:=rows->0->>'measured_at'; row_value:=(rows->0->>'source_row')::integer; file_name:=rows->0->>'source_file';
  if date_value<'2026-09-01' or date_value>'2026-12-31' or row_value not between 2 and 5001 then return null; end if;
  for i in 0..6 loop
    item:=rows->i;
    if item->>'source'<>group_source or item->>'source_file'<>file_name or item->>'measured_at'<>date_value or (item->>'source_row')::integer<>row_value
      or item->>'source_sheet'<>'CSV · Classified pitch summaries v1' or (item->>'source_column')::integer<>i
      or item->>'metric_key'<>keys[i+1] or item->>'metric'<>names[i+1]
      or item->>'unit'<>(case when i<2 then 'mph' when i<4 then 'rpm' else 'count' end)
      or left(item->>'observation_id',12)<>'observation:' then return null; end if;
    begin position:=substring(item->>'observation_id' from 13)::jsonb;
    exception when invalid_text_representation then return null; end;
    if position is distinct from jsonb_build_array(p_hash,'CSV · Classified pitch summaries v1',row_value,i) then return null; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(rows) r where (r->>'value')::float8<=0
    or (r->>'value')::float8 in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)) then return null; end if;
  if exists(select 1 from jsonb_array_elements(rows) r where r->>'unit'='count' and
    ((r->>'value')::numeric<>trunc((r->>'value')::numeric) or (r->>'value')::numeric not between 1 and 5000)) then return null; end if;
  pitches:=(rows->4->>'value')::numeric::integer; velocity_count:=(rows->5->>'value')::numeric::integer; spin_count:=(rows->6->>'value')::numeric::integer;
  if velocity_count>pitches or spin_count>pitches or (rows->0->>'value')::float8<(rows->1->>'value')::float8
    or (rows->2->>'value')::float8<(rows->3->>'value')::float8 then return null; end if;
  -- A different owner at the target coordinate is also a collision.
  if exists(select 1 from public.performance_measurements m where m.file_hash=p_hash
    and m.source_sheet='CSV · Classified pitch summaries v1' and m.source_row=row_value and m.source_column between 14 and 20) then return null; end if;
  select * into label_state from private.full_swing_pitch_assignments where file_hash=p_hash;
  if label_state.file_hash is null or jsonb_typeof(label_state.assignments) is distinct from 'array'
    or (select count(*) from jsonb_array_elements(label_state.assignments) a where a->>'pitchType'='Fastball')<pitches then return null; end if;
  return jsonb_build_object('fileHash',p_hash,'sourceFile',file_name,'date',date_value,'source',group_source,'currentType','Fastball',
    'measurementCount',7,'summaryRow',row_value,'assignmentVersion',label_state.version,
    'metrics',(select jsonb_agg(jsonb_build_object('metricKey',r->>'metric_key','value',r->'value','unit',r->>'unit','sourceColumn',r->'source_column') order by (r->>'source_column')::integer) from jsonb_array_elements(rows) r),
    'fingerprint',private.legacy_pitch_file_fingerprint(p_hash));
end $$;

create function private.legacy_pitch_reclassification_review(p_athlete uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate text; reviewed jsonb; result jsonb:='[]'::jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_athlete is null then raise exception 'Choose an existing player' using errcode='22023'; end if;
  for candidate in select distinct file_hash from public.performance_measurements where athlete_id=p_athlete
    and source ~ '^Full Swing · (Game|Intrasquad|Practice) · Fastball$' order by file_hash loop
    reviewed:=private.legacy_fastball_group(p_athlete,candidate);
    if reviewed is not null then result:=result||jsonb_build_array(reviewed); end if;
  end loop;
  if jsonb_array_length(result)>100 then raise exception 'Too many sessions for one review' using errcode='22023'; end if;
  return result;
end $$;

create function private.reclassify_legacy_fastball(p_request_id uuid,p_athlete uuid,p_file_hash text,p_fingerprint text,p_source_rows integer[],p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' set extra_float_digits=3 as $$
declare prior private.legacy_pitch_reclassification_requests; signature jsonb; reviewed jsonb; before_rows jsonb; after_rows jsonb;
  before_labels jsonb; after_labels jsonb; next_assignments jsonb; normalized integer[]; pitch_count integer;
  after_fingerprint text; result jsonb; affected integer; stamp timestamptz:=clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true or p_request_id is null or p_athlete is null or p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$'
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_source_rows is null
    or cardinality(p_source_rows) not between 1 and 5000 or array_ndims(p_source_rows)<>1
    or exists(select 1 from unnest(p_source_rows) r where r is null or r not between 2 and 5001)
    or (select count(distinct r) from unnest(p_source_rows) r)<>cardinality(p_source_rows) then
    raise exception 'Review the exact original CSV, player and pitch rows' using errcode='22023';
  end if;
  select array_agg(r order by r) into normalized from unnest(p_source_rows) r;
  signature:=jsonb_build_object('operation','reclassify','athlete',p_athlete,'fileHash',p_file_hash,'fingerprint',p_fingerprint,'sourceRows',normalized);
  select * into prior from private.legacy_pitch_reclassification_requests where request_id=p_request_id;
  if prior.request_id is not null then
    if prior.signature is distinct from signature or prior.actor_id<>auth.uid() then raise exception 'Correction request was already used' using errcode='23505'; end if;
    return prior.receipt;
  end if;
  reviewed:=private.legacy_fastball_group(p_athlete,p_file_hash);
  if reviewed is null or reviewed->>'fingerprint'<>p_fingerprint then raise exception 'Saved session changed or needs a complete CSV review; reload before correcting' using errcode='40001'; end if;
  pitch_count:=(reviewed->'metrics'->4->>'value')::numeric::integer;
  if cardinality(normalized)<>pitch_count or exists(select 1 from unnest(normalized) n where
    (select count(*) from private.full_swing_pitch_assignments s,jsonb_array_elements(s.assignments) a
      where s.file_hash=p_file_hash and a->>'pitchType'='Fastball' and (a->>'sourceRow')::integer=n)<>1) then
    raise exception 'Reviewed original pitch rows must match every saved pitch in this group' using errcode='22023';
  end if;
  select jsonb_agg(to_jsonb(m) order by m.source_column) into before_rows from public.performance_measurements m
    where m.athlete_id=p_athlete and m.file_hash=p_file_hash and m.source=reviewed->>'source';
  select to_jsonb(a) into before_labels from private.full_swing_pitch_assignments a where a.file_hash=p_file_hash;
  update public.performance_measurements m set source=regexp_replace(m.source,' · Fastball$',' · Four-Seam Fastball'),source_column=m.source_column+14,
    observation_id='observation:['||to_jsonb(m.file_hash)::text||','||to_jsonb(m.source_sheet)::text||','||m.source_row::text||','||(m.source_column+14)::text||']'
    where m.id in(select (r->>'id')::uuid from jsonb_array_elements(before_rows) r);
  get diagnostics affected=row_count;
  if affected<>7 then raise exception 'Saved group changed' using errcode='40001'; end if;
  select jsonb_agg(case when (a->>'sourceRow')::integer=any(normalized) then jsonb_set(a,'{pitchType}','"Four-Seam Fastball"'::jsonb) else a end order by (a->>'sourceRow')::integer)
    into next_assignments from jsonb_array_elements(before_labels->'assignments') a;
  update private.full_swing_pitch_assignments set assignments=next_assignments,version=version+1,updated_by=auth.uid(),updated_at=stamp
    where file_hash=p_file_hash;
  select jsonb_agg(to_jsonb(m) order by m.source_column) into after_rows from public.performance_measurements m
    where m.id in(select (r->>'id')::uuid from jsonb_array_elements(before_rows) r);
  select to_jsonb(a) into after_labels from private.full_swing_pitch_assignments a where a.file_hash=p_file_hash;
  after_fingerprint:=private.legacy_pitch_file_fingerprint(p_file_hash);
  result:=jsonb_build_object('requestId',p_request_id,'fileHash',p_file_hash,'measurementCount',7,'pitchCount',pitch_count,
    'assignmentVersion',after_labels->'version','restored',false,'afterFingerprint',after_fingerprint);
  insert into private.legacy_pitch_reclassifications(request_id,athlete_id,file_hash,source_rows,before_measurements,after_measurements,before_labels,after_labels,before_fingerprint,after_fingerprint,receipt,actor_id)
    values(p_request_id,p_athlete,p_file_hash,normalized,before_rows,after_rows,before_labels,after_labels,p_fingerprint,after_fingerprint,result,auth.uid());
  insert into private.legacy_pitch_reclassification_requests(request_id,signature,receipt,actor_id) values(p_request_id,signature,result,auth.uid());
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'legacy_pitch_reclassified',p_request_id,
    jsonb_build_object('measurementCount',7,'pitchCount',pitch_count));
  return result;
end $$;

create function private.restore_legacy_pitch_reclassification(p_request_id uuid,p_correction_request_id uuid,p_fingerprint text,p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' set extra_float_digits=3 as $$
declare prior private.legacy_pitch_reclassification_requests; correction private.legacy_pitch_reclassifications; signature jsonb; result jsonb;
  affected integer; version_value integer; stamp timestamptz:=clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true or p_request_id is null or p_correction_request_id is null
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Review this saved correction before restoring' using errcode='22023'; end if;
  signature:=jsonb_build_object('operation','restore','correctionRequestId',p_correction_request_id,'fingerprint',p_fingerprint);
  select * into prior from private.legacy_pitch_reclassification_requests where request_id=p_request_id;
  if prior.request_id is not null then
    if prior.signature is distinct from signature or prior.actor_id<>auth.uid() then raise exception 'Correction request was already used' using errcode='23505'; end if;
    return prior.receipt;
  end if;
  select * into correction from private.legacy_pitch_reclassifications where request_id=p_correction_request_id for update;
  if correction.request_id is null or correction.restored_at is not null or correction.after_fingerprint<>p_fingerprint
    or private.legacy_pitch_file_fingerprint(correction.file_hash)<>p_fingerprint
    or exists(select 1 from private.full_swing_publications where file_hash=correction.file_hash)
    or exists(select 1 from private.csv_measurement_archives where file_hash=correction.file_hash and restored_at is null) then
    raise exception 'Saved correction or session changed; restore requires the exact unchanged after-state' using errcode='40001';
  end if;
  update public.performance_measurements m set source=old.source,source_column=old.source_column,observation_id=old.observation_id
    from jsonb_populate_recordset(null::public.performance_measurements,correction.before_measurements) old where m.id=old.id;
  get diagnostics affected=row_count;
  if affected<>7 then raise exception 'Saved correction changed' using errcode='40001'; end if;
  update private.full_swing_pitch_assignments set assignments=correction.before_labels->'assignments',version=version+1,updated_by=auth.uid(),updated_at=stamp
    where file_hash=correction.file_hash returning version into version_value;
  update private.legacy_pitch_reclassifications set restored_by=auth.uid(),restored_at=stamp where request_id=p_correction_request_id;
  result:=jsonb_build_object('requestId',p_request_id,'correctionRequestId',p_correction_request_id,'fileHash',correction.file_hash,'measurementCount',7,
    'pitchCount',cardinality(correction.source_rows),'assignmentVersion',version_value,'restored',true,'afterFingerprint',private.legacy_pitch_file_fingerprint(correction.file_hash));
  insert into private.legacy_pitch_reclassification_requests(request_id,signature,receipt,actor_id) values(p_request_id,signature,result,auth.uid());
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'legacy_pitch_reclassification_restored',p_request_id,
    jsonb_build_object('measurementCount',7,'pitchCount',cardinality(correction.source_rows)));
  return result;
end $$;

create function private.legacy_pitch_reclassification_history(p_athlete uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_athlete is null then raise exception 'Choose an existing player' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('requestId',c.request_id,'fileHash',c.file_hash,'sourceFile',c.before_measurements->0->>'source_file',
    'date',c.before_measurements->0->>'measured_at','source',c.before_measurements->0->>'source','measurementCount',7,'pitchCount',cardinality(c.source_rows),'afterFingerprint',c.after_fingerprint,
    'canRestore',private.legacy_pitch_file_fingerprint(c.file_hash)=c.after_fingerprint
      and not exists(select 1 from private.full_swing_publications where file_hash=c.file_hash)
      and not exists(select 1 from private.csv_measurement_archives where file_hash=c.file_hash and restored_at is null)) order by c.created_at desc),'[]'::jsonb)
    into result from private.legacy_pitch_reclassifications c where c.athlete_id=p_athlete and c.restored_at is null;
  return result;
end $$;

-- An old browser draft must not recreate the retired coordinates in either direction.
-- Only the latest correction for a player/file governs its current state.
create function private.guard_reclassified_pitch_observation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from (
      select distinct on(athlete_id,file_hash) * from private.legacy_pitch_reclassifications
      where file_hash=new.file_hash order by athlete_id,file_hash,sequence desc
    ) c,jsonb_array_elements(case when c.restored_at is null then c.before_measurements else c.after_measurements end) r
    where r->>'observation_id'=new.observation_id
      or (r->>'source_sheet'=new.source_sheet and (r->>'source_row')::integer=new.source_row and (r->>'source_column')::integer=new.source_column)) then
    raise exception 'This pitch group was reclassified; reopen the original CSV and load its current labels' using errcode='23505';
  end if;
  return new;
end $$;
create trigger guard_reclassified_pitch_observation before insert on public.performance_measurements for each row execute function private.guard_reclassified_pitch_observation();

create function public.admin_legacy_pitch_reclassification_review(p_athlete uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.legacy_pitch_reclassification_review(p_athlete)$$;
create function public.admin_reclassify_legacy_fastball(p_request_id uuid,p_athlete uuid,p_file_hash text,p_fingerprint text,p_source_rows integer[],p_reviewed boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.reclassify_legacy_fastball(p_request_id,p_athlete,p_file_hash,p_fingerprint,p_source_rows,p_reviewed)$$;
create function public.admin_restore_legacy_pitch_reclassification(p_request_id uuid,p_correction_request_id uuid,p_fingerprint text,p_reviewed boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.restore_legacy_pitch_reclassification(p_request_id,p_correction_request_id,p_fingerprint,p_reviewed)$$;
create function public.admin_legacy_pitch_reclassification_history(p_athlete uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.legacy_pitch_reclassification_history(p_athlete)$$;
revoke all on function private.legacy_pitch_file_fingerprint(text),private.legacy_fastball_group(uuid,text),private.guard_reclassified_pitch_observation() from public,anon,authenticated;
revoke all on function private.legacy_pitch_reclassification_review(uuid),private.reclassify_legacy_fastball(uuid,uuid,text,text,integer[],boolean),
  private.restore_legacy_pitch_reclassification(uuid,uuid,text,boolean),private.legacy_pitch_reclassification_history(uuid),
  public.admin_legacy_pitch_reclassification_review(uuid),public.admin_reclassify_legacy_fastball(uuid,uuid,text,text,integer[],boolean),
  public.admin_restore_legacy_pitch_reclassification(uuid,uuid,text,boolean),public.admin_legacy_pitch_reclassification_history(uuid) from public,anon,authenticated;
grant execute on function private.legacy_pitch_reclassification_review(uuid),private.reclassify_legacy_fastball(uuid,uuid,text,text,integer[],boolean),
  private.restore_legacy_pitch_reclassification(uuid,uuid,text,boolean),private.legacy_pitch_reclassification_history(uuid),
  public.admin_legacy_pitch_reclassification_review(uuid),public.admin_reclassify_legacy_fastball(uuid,uuid,text,text,integer[],boolean),
  public.admin_restore_legacy_pitch_reclassification(uuid,uuid,text,boolean),public.admin_legacy_pitch_reclassification_history(uuid) to authenticated;
commit;
