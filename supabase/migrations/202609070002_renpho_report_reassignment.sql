-- Explicitly reviewed reassignment of one incorrectly owned report. Installation
-- changes no data; ordinary imports and additive alias sync keep their guards.
create function private.normalized_renpho_reassignment(p_request jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb; item jsonb; normalized text; ids jsonb := '[]'; seen text[] := '{}';
begin
  if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text) > 8192
    or (select count(*) from jsonb_object_keys(p_request)) <> 2
    or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('requestId', 'report'))
    or jsonb_typeof(p_request->'requestId') is distinct from 'string'
    or p_request->>'requestId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Review one report assignment' using errcode = '22023';
  end if;
  r := p_request->'report';
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r)) <> 4
    or exists(select 1 from jsonb_object_keys(r) k where k not in ('fileHash', 'fromAthleteCode', 'toAthleteCode', 'renphoIds'))
    or jsonb_typeof(r->'fileHash') is distinct from 'string' or r->>'fileHash' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(r->'fromAthleteCode') is distinct from 'string' or r->>'fromAthleteCode' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
    or jsonb_typeof(r->'toAthleteCode') is distinct from 'string' or r->>'toAthleteCode' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
    or r->>'fromAthleteCode' = r->>'toAthleteCode'
    or jsonb_typeof(r->'renphoIds') is distinct from 'array' or jsonb_array_length(r->'renphoIds') > 2 then
    raise exception 'Invalid single-report correction fields' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(r->'renphoIds') loop
    if jsonb_typeof(item) is distinct from 'string' then raise exception 'Review exact report IDs' using errcode = '22023'; end if;
    normalized := private.normalized_renpho_id(item #>> '{}');
    if normalized = any(seen) then raise exception 'Select each report ID once' using errcode = '22023'; end if;
    seen := array_append(seen, normalized); ids := ids || jsonb_build_array(normalized);
  end loop;
  return jsonb_build_object('requestId', lower(p_request->>'requestId'), 'report',
    jsonb_build_object('fileHash', r->>'fileHash', 'fromAthleteCode', r->>'fromAthleteCode',
      'toAthleteCode', r->>'toAthleteCode', 'renphoIds', ids));
end;
$$;

create function private.renpho_reassignment_snapshot(p_request jsonb)
returns jsonb language plpgsql set search_path = '' set extra_float_digits = 3 as $$
declare r jsonb := p_request->'report'; source_owner uuid; target_owner uuid; alias_owner uuid;
  observations jsonb; aliases jsonb := '[]'; alias_row jsonb; selected_id text;
  observation_count integer; date_count integer; report_date date; filename text; fingerprint text;
begin
  select id into source_owner from public.athletes where athlete_code = r->>'fromAthleteCode';
  select id into target_owner from public.athletes where athlete_code = r->>'toAthleteCode';
  if source_owner is null or target_owner is null then raise exception 'Select existing permanent athlete codes' using errcode = '22023'; end if;
  select count(*)::integer, count(distinct measured_at)::integer, min(measured_at), min(source_file)
    into observation_count, date_count, report_date, filename from public.performance_measurements where file_hash = r->>'fileHash';
  if observation_count not between 1 and 500 or date_count <> 1 then raise exception 'Report must have 1-500 saved readings on one test date' using errcode = '22023'; end if;
  if exists(select 1 from public.performance_measurements where file_hash = r->>'fileHash'
    and (athlete_id <> source_owner or source <> 'RENPHO' or source_sheet !~ '^RENPHO report · Page [1-9][0-9]*$')) then
    raise exception 'Report ownership or source changed; review again' using errcode = '40001';
  end if;
  select jsonb_agg(to_jsonb(m) order by m.id) into observations from public.performance_measurements m where m.file_hash = r->>'fileHash';
  for selected_id in select value from jsonb_array_elements_text(r->'renphoIds') loop
    select athlete_id, to_jsonb(i) into alias_owner, alias_row from private.renpho_identity_aliases i where renpho_id = selected_id;
    if alias_owner is null or alias_owner <> source_owner then raise exception 'Selected report ID does not belong to the reviewed source player' using errcode = '40001'; end if;
    aliases := aliases || jsonb_build_array(alias_row);
  end loop;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('actor', auth.uid(), 'request', p_request,
    'sourceOwner', source_owner, 'targetOwner', target_owner, 'observations', observations, 'aliases', aliases)::text, 'UTF8')), 'hex');
  return jsonb_build_object('fingerprint', fingerprint, 'report', r || jsonb_build_object('measurementCount', observation_count, 'measuredAt', report_date, 'sourceFile', filename));
end;
$$;

create function private.preview_renpho_report_reassignment(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  normalized := private.normalized_renpho_reassignment(p_request);
  if exists(select 1 from private.renpho_report_corrections where request_id = (normalized->>'requestId')::uuid) then
    raise exception 'This correction was already submitted; retry the saved review' using errcode = '22023';
  end if;
  return private.renpho_reassignment_snapshot(normalized);
end;
$$;

create function private.apply_renpho_report_reassignment(p_request jsonb, p_fingerprint text, p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized jsonb; current_review jsonb; previous private.renpho_report_corrections;
  r jsonb; source_owner uuid; target_owner uuid; selected_id text; moved integer; aliases integer := 0; changed integer; receipt jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  if p_reviewed is distinct from true or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Review the report correction before saving' using errcode = '22023'; end if;
  normalized := private.normalized_renpho_reassignment(p_request);
  select * into previous from private.renpho_report_corrections where request_id = (normalized->>'requestId')::uuid;
  if previous.request_id is not null then
    if previous.created_by <> auth.uid() or previous.request <> normalized or previous.fingerprint <> p_fingerprint then raise exception 'Correction request already used for a different review' using errcode = '23505'; end if;
    return previous.receipt;
  end if;
  current_review := private.renpho_reassignment_snapshot(normalized);
  if current_review->>'fingerprint' <> p_fingerprint then raise exception 'Report changed since review; no correction was applied' using errcode = '40001'; end if;
  r := normalized->'report';
  select id into source_owner from public.athletes where athlete_code = r->>'fromAthleteCode';
  select id into target_owner from public.athletes where athlete_code = r->>'toAthleteCode';
  update public.performance_measurements set athlete_id = target_owner where file_hash = r->>'fileHash' and athlete_id = source_owner;
  get diagnostics moved = row_count;
  if moved <> (current_review->'report'->>'measurementCount')::integer then raise exception 'Report changed; no correction was applied' using errcode = '40001'; end if;
  for selected_id in select value from jsonb_array_elements_text(r->'renphoIds') loop
    update private.renpho_identity_aliases set athlete_id = target_owner where renpho_id = selected_id and athlete_id = source_owner;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'Report ID changed; no correction was applied' using errcode = '40001'; end if;
    aliases := aliases + changed;
  end loop;
  receipt := jsonb_build_object('requestId', normalized->>'requestId', 'measurementsMoved', moved, 'aliasesMoved', aliases);
  insert into private.renpho_report_corrections(request_id, created_by, request, fingerprint, receipt)
    values((normalized->>'requestId')::uuid, auth.uid(), normalized, p_fingerprint, receipt);
  insert into public.audit_events(actor_id, event_type, target_id, details)
    values(auth.uid(), 'renpho_report_reassigned', (normalized->>'requestId')::uuid, jsonb_build_object('reports', 1, 'measurementsMoved', moved, 'aliasesMoved', aliases));
  return receipt;
end;
$$;

create function public.admin_preview_renpho_report_reassignment(p_request jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.preview_renpho_report_reassignment(p_request); $$;
create function public.admin_apply_renpho_report_reassignment(p_request jsonb, p_fingerprint text, p_reviewed boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.apply_renpho_report_reassignment(p_request, p_fingerprint, p_reviewed); $$;
revoke all on function private.normalized_renpho_reassignment(jsonb), private.renpho_reassignment_snapshot(jsonb),
  private.preview_renpho_report_reassignment(jsonb), private.apply_renpho_report_reassignment(jsonb, text, boolean) from public, anon, authenticated;
grant execute on function private.preview_renpho_report_reassignment(jsonb), private.apply_renpho_report_reassignment(jsonb, text, boolean) to authenticated;
revoke all on function public.admin_preview_renpho_report_reassignment(jsonb), public.admin_apply_renpho_report_reassignment(jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_preview_renpho_report_reassignment(jsonb), public.admin_apply_renpho_report_reassignment(jsonb, text, boolean) to authenticated;
