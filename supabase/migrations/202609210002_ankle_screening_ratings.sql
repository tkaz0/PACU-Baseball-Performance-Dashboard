-- Owner correction: ankle flexion/extension are 1–5 ratings, not degrees.
-- Retain stored readings, source hashes and existing access grants.
begin;
create or replace function private.import_movement_screenings(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb; reading jsonb; idx integer; v text; field text; target uuid; prior public.movement_screenings; inserted_id uuid; ids jsonb:='[]'; created_count integer:=0; unchanged_count integer:=0; seen text[]:='{}'; identity_key text; row_number integer; source_rows integer[];
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1000000 then raise exception 'Invalid screening file'; end if;
 if (select array_agg(key order by key) from jsonb_object_keys(p_payload) key) is distinct from array['reports','source','version'] or p_payload->'version' is distinct from '1'::jsonb or p_payload->>'source' is distinct from '1Uu-bmZT-ol7ccW96H_1DAFOEI7LdGYTFgJfFUvJdDsU' or jsonb_typeof(p_payload->'reports') is distinct from 'array' then raise exception 'Invalid screening file'; end if;
 if jsonb_array_length(p_payload->'reports') not between 1 and 50 then raise exception 'Invalid report count'; end if;
 for report in select value from jsonb_array_elements(p_payload->'reports') loop
  if jsonb_typeof(report) is distinct from 'object' then raise exception 'Invalid report'; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(report) key) is distinct from array['athleteCode','readings','screenedOn','sheetId','sourceHash'] or jsonb_typeof(report->'athleteCode') is distinct from 'string' or report->>'athleteCode' !~ '^PAC-[0-9]{4,6}$' or jsonb_typeof(report->'sheetId') is distinct from 'number' or report->>'sheetId' !~ '^[0-9]{1,10}$' or (report->>'sheetId')::numeric>2147483647 or jsonb_typeof(report->'sourceHash') is distinct from 'string' or report->>'sourceHash' !~ '^[a-f0-9]{64}$' or jsonb_typeof(report->'screenedOn') is distinct from 'string' or report->>'screenedOn' !~ '^2026-[0-9]{2}-[0-9]{2}$' or (report->>'screenedOn')::date not between date '2026-09-01' and date '2026-12-31' or jsonb_typeof(report->'readings') is distinct from 'array' then raise exception 'Invalid report'; end if;
  if jsonb_array_length(report->'readings')<>24 then raise exception 'Invalid reading count'; end if;
  identity_key:=(report->>'sheetId')||':'||(report->>'screenedOn');
  if identity_key=any(seen) then raise exception 'Repeated source report'; end if;
  seen:=array_append(seen,identity_key);
  source_rows:='{}';
  for idx in 0..23 loop
   reading:=report->'readings'->idx;row_number:=idx+2;
   if jsonb_typeof(reading) is distinct from 'object' then raise exception 'Invalid reading'; end if;
   if (select array_agg(key order by key) from jsonb_object_keys(reading) key) is distinct from array['color','reference','row','sourceRow','value'] or reading->'row' is distinct from to_jsonb(row_number) or jsonb_typeof(reading->'color') is distinct from 'string' or reading->>'color' not in ('none','green','yellow','red') then raise exception 'Invalid reading'; end if;
   if jsonb_typeof(reading->'sourceRow') is distinct from 'number' or reading->>'sourceRow' !~ '^[0-9]{1,2}$' or (reading->>'sourceRow')::integer not between 2 and 25 or (reading->>'sourceRow')::integer=any(source_rows) then raise exception 'Invalid source row'; end if;
   source_rows:=array_append(source_rows,(reading->>'sourceRow')::integer);
   foreach field in array array['value','reference'] loop
    if reading->field <> 'null'::jsonb then
     v:=reading->>field;
     if jsonb_typeof(reading->field) is distinct from 'string' or length(v) not between 1 and 120 or btrim(v)<>v or v ~ '[[:cntrl:]]' then raise exception 'Invalid cell'; end if;
    end if;
   end loop;
   v:=reading->>'value';
   if v is not null then
    if row_number between 4 and 15 then
     if v !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'Invalid degree value'; end if;
     if abs(v::numeric)>360 then raise exception 'Invalid degree value'; end if;
    elsif row_number between 16 and 19 then
     if v !~ '^[1-5]$' then raise exception 'Invalid ankle rating'; end if;
    elsif v ~ '^-?[0-9]+(\.[0-9]+)?$' then
     if v::numeric not between 1 and 5 or trunc(v::numeric)<>v::numeric then raise exception 'Invalid rating'; end if;
    end if;
   end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements(report->'readings') r where r->>'value' is not null) then raise exception 'Empty report'; end if;
  select id into target from public.athletes where athlete_code=report->>'athleteCode';
  if target is null then raise exception 'Unknown athlete'; end if;
  select * into prior from public.movement_screenings where source_sheet_id=(report->>'sheetId')::integer and screened_on=(report->>'screenedOn')::date;
  if prior.id is not null then
   if prior.athlete_id<>target or prior.source_hash<>report->>'sourceHash' or prior.readings<>report->'readings' then raise exception 'Source report changed; review required'; end if;
   unchanged_count:=unchanged_count+1;inserted_id:=prior.id;
  else
   insert into public.movement_screenings(athlete_id,source_sheet_id,screened_on,source_hash,readings,created_by) values(target,(report->>'sheetId')::integer,(report->>'screenedOn')::date,report->>'sourceHash',report->'readings',auth.uid()) returning id into inserted_id;
   created_count:=created_count+1;
  end if;
  ids:=ids||jsonb_build_array(inserted_id);
 end loop;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'movement_screenings_imported',jsonb_build_object('created',created_count,'unchanged',unchanged_count));
 return jsonb_build_object('created',created_count,'unchanged',unchanged_count,'ids',ids);
end;
$$;
commit;
