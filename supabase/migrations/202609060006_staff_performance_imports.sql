-- Reviewed performance information imports are available to active Admins and
-- Coaches. Roster, account, invitation and athlete-ID management remain Admin-only.
-- Both import layers recheck trusted roles after acquiring the existing lock.
create or replace function private.import_performance_original_codes(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r jsonb; key_name text; observation jsonb; athlete uuid; old public.performance_measurements;
  definition private.performance_metric_catalog; measured date; number_value float8;
  row_number integer; column_number integer; receipt uuid; created integer:=0; unchanged integer:=0;
  seen_positions text[]:='{}'; position_key text;
  fields text[]:=array['observation_id','athlete_code','metric_key','measured_at','value','unit','source','source_file','source_sheet','source_row','file_hash'];
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active administrator or coach required' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    raise exception 'Reviewed import requires 1–500 observations within 1 MiB' using errcode='22023';
  end if;
  if (select count(distinct x->>'observation_id') from jsonb_array_elements(p_rows) x) <> jsonb_array_length(p_rows) then
    raise exception 'Duplicate observation IDs in reviewed input' using errcode='22023';
  end if;
  insert into public.performance_imports(created_by) values(auth.uid()) returning id into receipt;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>cardinality(fields)
      or exists(select 1 from jsonb_object_keys(r) k where not k=any(fields)) then raise exception 'Unexpected measurement fields' using errcode='22023'; end if;
    foreach key_name in array fields loop
      if key_name in ('value','source_row') then
        if jsonb_typeof(r->key_name) is distinct from 'number' then raise exception 'Measurement value and source row must be numbers' using errcode='22023'; end if;
      elsif jsonb_typeof(r->key_name) is distinct from 'string' or length(r->>key_name)>2000 or (r->>key_name) ~ '[[:cntrl:]]'
        or (r->>key_name)<>btrim(r->>key_name) then raise exception 'Invalid measurement text field' using errcode='22023'; end if;
    end loop;
    if r->>'athlete_code' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' or r->>'file_hash' !~ '^[a-f0-9]{64}$'
      or length(r->>'source') not between 1 and 100 or length(r->>'source_file') not between 1 and 300 or length(r->>'source_sheet')>255
      or r->>'measured_at' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid measurement identity, date or provenance' using errcode='22023'; end if;
    begin
      measured:=(r->>'measured_at')::date;
      number_value:=(r->>'value')::float8;
      row_number:=(r->>'source_row')::integer;
      if (r->>'source_row')::numeric<>row_number then raise exception 'Non-integer source row'; end if;
      if left(r->>'observation_id',12)<>'observation:' then raise exception 'Invalid observation ID'; end if;
      observation:=substring(r->>'observation_id' from 13)::jsonb;
      if jsonb_typeof(observation) is distinct from 'array' or jsonb_array_length(observation)<>4
        or observation->>0 is distinct from r->>'file_hash' or observation->>1 is distinct from r->>'source_sheet'
        or jsonb_typeof(observation->2) is distinct from 'number' or jsonb_typeof(observation->3) is distinct from 'number'
        or (observation->>2)::numeric<>row_number then raise exception 'Observation provenance mismatch'; end if;
      column_number:=(observation->>3)::integer;
      if (observation->>3)::numeric<>column_number then raise exception 'Non-integer source column'; end if;
    exception when others then raise exception 'Invalid measurement number, date or source observation ID' using errcode='22023'; end;
    position_key:=jsonb_build_array(r->>'file_hash',r->>'source_sheet',row_number,column_number)::text;
    if position_key=any(seen_positions) then raise exception 'Duplicate source positions in reviewed input' using errcode='22023'; end if;
    seen_positions:=array_append(seen_positions,position_key);
    select * into definition from private.performance_metric_catalog where metric_key=r->>'metric_key';
    if definition.metric_key is null or not exists(select 1 from private.performance_metric_units where metric_key=definition.metric_key and unit=r->>'unit')
      or number_value<0 or number_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
      or (definition.positive_only and number_value<=0) or (definition.percentage and number_value>100)
      or row_number not between 1 and 1000000 or column_number not between 0 and 10000
      or measured not between '2000-01-01'::date and '2099-12-31'::date then raise exception 'Unsupported metric, unit or value' using errcode='22023'; end if;
    select id into athlete from public.athletes where athlete_code=r->>'athlete_code';
    if athlete is null then raise exception 'Select an existing permanent athlete code' using errcode='22023'; end if;
    select * into old from public.performance_measurements where observation_id=r->>'observation_id'
      or (file_hash=r->>'file_hash' and source_sheet=r->>'source_sheet' and source_row=row_number and source_column=column_number);
    if old.id is not null then
      if old.athlete_id<>athlete or old.metric_key<>definition.metric_key or old.unit<>r->>'unit' or old.measured_at<>measured or old.value<>number_value
        or old.source<>r->>'source' or old.file_hash<>r->>'file_hash' or old.source_sheet<>r->>'source_sheet' or old.source_row<>row_number or old.source_column<>column_number then
        raise exception 'Source observation already exists with different reviewed data; no values were replaced' using errcode='23505';
      end if;
      -- The original filename and import provenance survive renamed-file retries.
      unchanged:=unchanged+1;
    else
      insert into public.performance_measurements(observation_id,athlete_id,metric_key,metric,unit,measured_at,value,source,source_file,source_sheet,source_row,source_column,file_hash,import_id,imported_by)
      values(r->>'observation_id',athlete,definition.metric_key,definition.metric_label,r->>'unit',measured,number_value,r->>'source',r->>'source_file',r->>'source_sheet',row_number,column_number,r->>'file_hash',receipt,auth.uid());
      created:=created+1;
    end if;
  end loop;
  update public.performance_imports set created_count=created,unchanged_count=unchanged where id=receipt;
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'performance_imported',receipt,jsonb_build_object('created',created,'unchanged',unchanged));
  return jsonb_build_object('import_id',receipt,'created',created,'unchanged',unchanged);
end;
$$;

create or replace function private.import_performance(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active administrator or coach required' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    return private.import_performance_original_codes(p_rows);
  end if;
  select jsonb_agg(case when jsonb_typeof(x.value)='object' and jsonb_typeof(x.value->'athlete_code')='string'
    then jsonb_set(x.value,'{athlete_code}',to_jsonb(private.canonical_athlete_code(x.value->>'athlete_code'))) else x.value end order by x.ordinality)
    into normalized from jsonb_array_elements(p_rows) with ordinality x;
  return private.import_performance_original_codes(normalized);
end;
$$;

-- Coaches can inspect only their own receipts. They gain no audit-table access.
drop policy performance_imports_read on public.performance_imports;
create policy performance_imports_read on public.performance_imports for select to authenticated
using (private.has_role('admin') or (private.has_role('coach') and created_by = (select auth.uid())));

revoke all on function private.import_performance_original_codes(jsonb) from public,anon,authenticated;
revoke all on function private.import_performance(jsonb) from public,anon,authenticated;
grant execute on function private.import_performance(jsonb) to authenticated;
-- Preserve the existing public API name for old clients; its trusted role checks
-- now allow either staff role. No direct measurement-table writes are granted.
revoke all on function public.admin_import_performance(jsonb) from public,anon,authenticated;
grant execute on function public.admin_import_performance(jsonb) to authenticated;

-- Staff report review needs the original source positions for repeat-file dedup.
-- Keep RLS/caller permissions, cap the result, and retain exact float8 values.
create function public.performance_report_measurements(p_file_hash text)
returns jsonb language plpgsql stable security invoker
set search_path = '' set extra_float_digits = 3 as $$
declare result jsonb;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active administrator or coach required' using errcode = '42501';
  end if;
  if p_file_hash is null or length(p_file_hash) <> 64 or p_file_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid report hash' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.observation_id, 'athlete_code', m.athlete_code,
    'measured_at', m.measured_at, 'source', m.source,
    'metric', m.metric, 'value', m.value, 'unit', m.unit,
    'source_file', m.source_file, 'source_sheet', m.source_sheet,
    'source_row', m.source_row, 'file_hash', m.file_hash
  ) order by m.observation_id), '[]'::jsonb) into result
  from (
    select p.observation_id, a.athlete_code, p.measured_at, p.source,
      p.metric, p.value, p.unit, p.source_file, p.source_sheet,
      p.source_row, p.file_hash
    from public.performance_measurements p
    join public.athletes a on a.id = p.athlete_id
    where p.file_hash = p_file_hash
    order by p.observation_id limit 501
  ) m;
  return result;
end;
$$;
revoke all on function public.performance_report_measurements(text) from public, anon, authenticated;
grant execute on function public.performance_report_measurements(text) to authenticated;
