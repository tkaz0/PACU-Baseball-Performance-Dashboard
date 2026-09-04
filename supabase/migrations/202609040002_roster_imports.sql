-- Strict template import. The database repeats validation for direct RPC callers.
create function private.roster_errors(r jsonb) returns text[] language plpgsql immutable set search_path = '' as $$
declare
  errors text[] := '{}'; k text; v text;
  allowed text[] := array['athlete_code','first_name','preferred_name','last_name','pacific_email','jersey_number','primary_position','secondary_position','player_type','bats','throws','academic_class','eligibility_year','graduation_year','roster_status','profile_photo_url'];
begin
  if jsonb_typeof(r) is distinct from 'object' then return array['Row must be an object']; end if;
  if exists(select 1 from jsonb_object_keys(r) f where not f = any(allowed)) then errors := array_append(errors, 'Unknown field'); end if;
  foreach k in array allowed loop
    if not r ? k or jsonb_typeof(r->k) is distinct from 'string' then errors := array_append(errors, k || ': expected a text cell');
    elsif length(r->>k) > 2048 or (r->>k) <> btrim(r->>k) or (r->>k) ~ '[[:cntrl:]]' then errors := array_append(errors, k || ': invalid length, whitespace or control characters'); end if;
  end loop;
  if cardinality(errors) > 0 then return errors; end if;
  if r->>'athlete_code' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' then errors := array_append(errors, 'athlete_code: use 3–40 uppercase letters, numbers, underscores or hyphens'); end if;
  foreach k in array array['first_name','last_name'] loop
    if length(r->>k) not between 1 and 80 then errors := array_append(errors, k || ': required, maximum 80 characters'); end if;
  end loop;
  if length(r->>'preferred_name') > 80 then errors := array_append(errors, 'preferred_name: maximum 80 characters'); end if;
  v := r->>'pacific_email';
  if v <> '' and (length(v) > 254 or v <> lower(v) or v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then errors := array_append(errors, 'pacific_email: invalid email'); end if;
  v := r->>'profile_photo_url';
  if v <> '' and v !~ '^https://([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}([/?#][^[:space:][:cntrl:]]*)?$' then errors := array_append(errors, 'profile_photo_url: use an HTTPS domain URL without credentials or a port'); end if;
  foreach k in array array['primary_position','secondary_position'] loop
    if r->>k <> '' and r->>k not in ('P','C','1B','2B','3B','SS','LF','CF','RF','OF','IF','DH','UT') then errors := array_append(errors, k || ': invalid position'); end if;
  end loop;
  if r->>'player_type' not in ('','pitcher','position','two_way') then errors := array_append(errors, 'player_type: use pitcher, position or two_way'); end if;
  foreach k in array array['bats','throws'] loop
    if r->>k not in ('','L','R','S') then errors := array_append(errors, k || ': use L, R or S'); end if;
  end loop;
  if r->>'academic_class' not in ('','freshman','sophomore','junior','senior','graduate') then errors := array_append(errors, 'academic_class: invalid class'); end if;
  if r->>'roster_status' not in ('','active','inactive','redshirt','alumni') then errors := array_append(errors, 'roster_status: invalid status'); end if;
  if r->>'jersey_number' <> '' and r->>'jersey_number' !~ '^[0-9]{1,2}$' then errors := array_append(errors, 'jersey_number: use 0–99'); end if;
  if r->>'eligibility_year' <> '' and r->>'eligibility_year' !~ '^[1-6]$' then errors := array_append(errors, 'eligibility_year: use 1–6'); end if;
  if r->>'graduation_year' <> '' and r->>'graduation_year' !~ '^(20[0-9]{2}|2100)$' then errors := array_append(errors, 'graduation_year: use 2000–2100'); end if;
  return errors;
end;
$$;

create function private.plan_roster(p_rows jsonb, p_season text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; row_no integer := 1; errors text[]; a public.athletes; s public.athlete_seasons;
  old_a jsonb; old_s jsonb; new_a jsonb; new_s jsonb; k text; v jsonb;
  result jsonb := '[]'; changes jsonb; action text;
begin
  if p_season is null or p_season !~ '^20[0-9]{2}(-[0-9]{2})?$' then raise exception 'Season must be YYYY or YYYY-YY'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Rows must be an array'; end if;
  -- JSON field names/escaping expand the separately capped 1 MiB CSV upload.
  if jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text) > 3145728 then raise exception 'Import must contain 1–500 rows and fit within 3 MiB of normalized JSON'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    row_no := row_no + 1;
    errors := private.roster_errors(r);
    if (select count(*) from jsonb_array_elements(p_rows) t where upper(btrim(t->>'athlete_code')) = upper(btrim(r->>'athlete_code'))) > 1 then errors := array_append(errors, 'Duplicate athlete_code in file'); end if;
    if coalesce(r->>'pacific_email','') <> '' and (select count(*) from jsonb_array_elements(p_rows) t where lower(btrim(t->>'pacific_email')) = lower(btrim(r->>'pacific_email'))) > 1 then errors := array_append(errors, 'Email is assigned to multiple rows'); end if;
    if coalesce(r->>'pacific_email','') <> '' and exists(select 1 from public.athletes where lower(pacific_email) = lower(r->>'pacific_email') and athlete_code <> r->>'athlete_code') then errors := array_append(errors, 'Email belongs to another athlete_code'); end if;
    if cardinality(errors) > 0 then
      result := result || jsonb_build_array(jsonb_build_object('row', row_no, 'athlete_code', r->>'athlete_code', 'action', 'reject', 'errors', errors, 'changes', '[]'::jsonb));
      continue;
    end if;
    select * into a from public.athletes where athlete_code = r->>'athlete_code';
    select * into s from public.athlete_seasons where athlete_id = a.id and season = p_season;
    old_a := case when a.id is null then '{}'::jsonb else to_jsonb(a) end;
    old_s := case when s.athlete_id is null then '{}'::jsonb else to_jsonb(s) end;
    new_a := old_a; new_s := old_s; changes := '[]';
    foreach k in array array['athlete_code','first_name','preferred_name','last_name','pacific_email','profile_photo_url'] loop
      v := case when r->>k <> '' then r->k else coalesce(old_a->k, 'null'::jsonb) end;
      new_a := new_a || jsonb_build_object(k, v);
      if coalesce(old_a->k,'null'::jsonb) is distinct from v then changes := changes || jsonb_build_array(jsonb_build_object('field',k,'before',old_a->k,'after',v)); end if;
    end loop;
    foreach k in array array['jersey_number','primary_position','secondary_position','player_type','bats','throws','academic_class','eligibility_year','graduation_year','roster_status'] loop
      if r->>k = '' then v := coalesce(old_s->k,'null'::jsonb);
      elsif k in ('jersey_number','eligibility_year','graduation_year') then v := to_jsonb((r->>k)::integer);
      else v := r->k; end if;
      new_s := new_s || jsonb_build_object(k, v);
      if coalesce(old_s->k,'null'::jsonb) is distinct from v then changes := changes || jsonb_build_array(jsonb_build_object('field',k,'before',old_s->k,'after',v)); end if;
    end loop;
    if a.id is null then action := 'create';
    elsif s.athlete_id is null or new_a <> old_a or new_s <> old_s then action := 'update';
    else action := 'unchanged'; end if;
    if a.id is not null and s.athlete_id is null then changes := changes || jsonb_build_array(jsonb_build_object('field','season','before',null,'after',p_season)); end if;
    result := result || jsonb_build_array(jsonb_build_object('row', row_no, 'athlete_code', r->>'athlete_code', 'action', action, 'errors', '[]'::jsonb,
      'changes', changes, 'before', jsonb_build_object('identity',old_a,'season',old_s), 'after', jsonb_build_object('identity',new_a,'season',new_s)));
  end loop;
  return jsonb_build_object('rows',result,'create',(select count(*) from jsonb_array_elements(result) t where t->>'action'='create'),
    'update',(select count(*) from jsonb_array_elements(result) t where t->>'action'='update'),
    'unchanged',(select count(*) from jsonb_array_elements(result) t where t->>'action'='unchanged'),
    'reject',(select count(*) from jsonb_array_elements(result) t where t->>'action'='reject'));
end;
$$;

create function private.stage_roster(p_rows jsonb, p_season text, p_filename text, p_sha256 text) returns uuid language plpgsql security definer set search_path = '' as $$
declare draft_id uuid; planned jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  if p_filename is null or length(p_filename) not between 1 and 160 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source metadata'; end if;
  planned := private.plan_roster(p_rows, p_season);
  insert into public.roster_imports(created_by, season, filename, source_sha256, input_rows, preview)
    values (auth.uid(),p_season,p_filename,p_sha256,p_rows,planned) returning id into draft_id;
  insert into public.audit_events(actor_id,event_type,import_id,details) values (auth.uid(),'roster_previewed',draft_id,planned - 'rows');
  return draft_id;
end;
$$;
create function private.apply_roster(p_import_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare draft public.roster_imports; planned jsonb; item jsonb; a public.athletes; s public.athlete_seasons; athlete_id uuid;
begin
  -- Match the account-management lock order. Recheck after waiting on locks.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  select * into draft from public.roster_imports where id = p_import_id for update;
  if draft.id is null or draft.created_by <> auth.uid() then raise exception 'Only the uploading administrator can approve this draft' using errcode = '42501'; end if;
  if draft.status = 'applied' then return draft.preview - 'rows'; end if;
  if draft.created_at < now() - interval '24 hours' then raise exception 'Preview expired. Upload again.'; end if;
  planned := private.plan_roster(draft.input_rows, draft.season);
  if planned <> draft.preview then raise exception 'Roster changed after preview. Upload again and review the new changes.'; end if;
  if (planned->>'reject')::integer > 0 then raise exception 'Resolve all rejected rows before approval'; end if;
  for item in select value from jsonb_array_elements(planned->'rows') loop
    if item->>'action' = 'unchanged' then continue; end if;
    a := jsonb_populate_record(null::public.athletes,item->'after'->'identity');
    s := jsonb_populate_record(null::public.athlete_seasons,item->'after'->'season');
    insert into public.athletes(athlete_code,first_name,preferred_name,last_name,pacific_email,profile_photo_url)
      values(a.athlete_code,a.first_name,a.preferred_name,a.last_name,a.pacific_email,a.profile_photo_url)
      on conflict (athlete_code) do update set first_name=excluded.first_name,preferred_name=excluded.preferred_name,last_name=excluded.last_name,
        pacific_email=excluded.pacific_email,profile_photo_url=excluded.profile_photo_url,updated_at=now()
      returning id into athlete_id;
    insert into public.athlete_seasons(athlete_id,season,jersey_number,primary_position,secondary_position,player_type,bats,throws,academic_class,eligibility_year,graduation_year,roster_status)
      values(athlete_id,draft.season,s.jersey_number,s.primary_position,s.secondary_position,s.player_type,s.bats,s.throws,s.academic_class,s.eligibility_year,s.graduation_year,s.roster_status)
      on conflict on constraint athlete_seasons_pkey do update set jersey_number=excluded.jersey_number,primary_position=excluded.primary_position,
        secondary_position=excluded.secondary_position,player_type=excluded.player_type,bats=excluded.bats,throws=excluded.throws,
        academic_class=excluded.academic_class,eligibility_year=excluded.eligibility_year,graduation_year=excluded.graduation_year,roster_status=excluded.roster_status,updated_at=now();
    insert into public.audit_events(actor_id,event_type,target_id,import_id,details)
      values(auth.uid(),'roster_' || (item->>'action'),athlete_id,draft.id,item);
  end loop;
  update public.roster_imports set status='applied',applied_at=now(),applied_by=auth.uid() where id=draft.id;
  insert into public.audit_events(actor_id,event_type,import_id,details) values(auth.uid(),'roster_applied',draft.id,planned - 'rows');
  return planned - 'rows';
end;
$$;

create function public.stage_roster_import(p_rows jsonb, p_season text, p_filename text, p_sha256 text)
returns uuid language sql security invoker set search_path = '' as $$ select private.stage_roster(p_rows,p_season,p_filename,p_sha256); $$;
create function public.approve_roster_import(p_import_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select private.apply_roster(p_import_id); $$;

revoke all on function private.roster_errors(jsonb),private.plan_roster(jsonb,text),private.stage_roster(jsonb,text,text,text),private.apply_roster(uuid) from public,anon,authenticated;
grant execute on function private.stage_roster(jsonb,text,text,text),private.apply_roster(uuid) to authenticated;
revoke all on function public.stage_roster_import(jsonb,text,text,text),public.approve_roster_import(uuid) from public,anon;
grant execute on function public.stage_roster_import(jsonb,text,text,text),public.approve_roster_import(uuid) to authenticated;
