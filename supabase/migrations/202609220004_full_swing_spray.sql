begin;
-- Nullable, row-paired spatial readings extend the existing immutable contact record.
alter table public.full_swing_contacts
  add column direction double precision check (direction between -90 and 90),
  add column distance double precision check (distance between 0 and 1000),
  add constraint full_swing_spatial_pair check ((direction is null) = (distance is null));

create or replace function private.import_full_swing_contacts(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; target uuid; prior public.full_swing_contacts; created integer:=0; unchanged integer:=0; enriched integer:=0;
  row_number integer; pitch integer; speed double precision; angle double precision; played date; hash text;
  source_name text; kind text; reviewed_code text; bearing double precision; feet double precision;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if jsonb_typeof(p_rows) is distinct from 'array' or pg_catalog.octet_length(p_rows::text)>1000000 or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'Invalid contact review';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or
      (select array_agg(key order by key) from jsonb_object_keys(r) key) not in
        (array['athleteCode','category','exitVelocity','fileHash','launchAngle','pitchNumber','playedOn','sourceFile','sourceRow'],
         array['athleteCode','category','direction','distance','exitVelocity','fileHash','launchAngle','pitchNumber','playedOn','sourceFile','sourceRow']) or
      jsonb_typeof(r->'athleteCode') is distinct from 'string' or r->>'athleteCode' !~ '^PAC-[0-9]{4,6}$' or
      jsonb_typeof(r->'fileHash') is distinct from 'string' or r->>'fileHash' !~ '^[a-f0-9]{64}$' or
      jsonb_typeof(r->'sourceFile') is distinct from 'string' or length(r->>'sourceFile') not between 1 and 300 or btrim(r->>'sourceFile')<>(r->>'sourceFile') or (r->>'sourceFile') ~ '[[:cntrl:]]' or
      jsonb_typeof(r->'sourceRow') is distinct from 'number' or r->>'sourceRow' !~ '^[0-9]{1,7}$' or
      jsonb_typeof(r->'pitchNumber') is distinct from 'number' or r->>'pitchNumber' !~ '^[0-9]{1,7}$' or
      jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-(09|10|11|12)-[0-9]{2}$' or
      jsonb_typeof(r->'category') is distinct from 'string' or r->>'category' not in ('game','intrasquad','practice') or
      jsonb_typeof(r->'exitVelocity') is distinct from 'number' or jsonb_typeof(r->'launchAngle') is distinct from 'number' or
      r->>'exitVelocity' !~ '^[0-9]+(\.[0-9]+)?$' or r->>'launchAngle' !~ '^-?[0-9]+(\.[0-9]+)?$' or
      (r ? 'direction') <> (r ? 'distance') or
      (r ? 'direction' and ((jsonb_typeof(r->'direction') = 'null') <> (jsonb_typeof(r->'distance') = 'null'))) or
      (r ? 'direction' and jsonb_typeof(r->'direction') not in ('number','null')) or
      (r ? 'distance' and jsonb_typeof(r->'distance') not in ('number','null')) or
      (jsonb_typeof(r->'direction') = 'number' and r->>'direction' !~ '^-?[0-9]+(\.[0-9]+)?$') or
      (jsonb_typeof(r->'distance') = 'number' and r->>'distance' !~ '^[0-9]+(\.[0-9]+)?$') then
      raise exception 'Invalid contact row';
    end if;
    row_number:=(r->>'sourceRow')::integer; pitch:=(r->>'pitchNumber')::integer;
    speed:=(r->>'exitVelocity')::double precision; angle:=(r->>'launchAngle')::double precision;
    bearing:=case when jsonb_typeof(r->'direction')='number' then (r->>'direction')::double precision else null end;
    feet:=case when jsonb_typeof(r->'distance')='number' then (r->>'distance')::double precision else null end;
    played:=(r->>'playedOn')::date; hash:=r->>'fileHash';source_name:=r->>'sourceFile';kind:=r->>'category';reviewed_code:=r->>'athleteCode';
    if row_number<2 or pitch<1 or speed<=0 or speed>200 or angle not between -90 and 90 or played not between date '2026-09-01' and date '2026-12-31' or
      (bearing is null) <> (feet is null) or (bearing is not null and (bearing not between -90 and 90 or feet not between 0 and 1000)) then
      raise exception 'Invalid contact value';
    end if;
    select a.id into target from public.athletes a where a.athlete_code=reviewed_code;
    if target is null then raise exception 'Unknown reviewed athlete'; end if;
    select * into prior from public.full_swing_contacts where file_hash=hash and source_row=row_number;
    if prior.file_hash is not null then
      if prior.athlete_id<>target or prior.pitch_number<>pitch or prior.source_file<>source_name or prior.played_on<>played or prior.category<>kind or prior.exit_velocity<>speed or prior.launch_angle<>angle or
        (bearing is not null and prior.direction is not null and (prior.direction<>bearing or prior.distance<>feet)) then
        raise exception 'Source contact changed; review required';
      end if;
      if bearing is not null and prior.direction is null then
        update public.full_swing_contacts set direction=bearing,distance=feet where file_hash=hash and source_row=row_number;
        enriched:=enriched+1;
      end if;
      unchanged:=unchanged+1;
    else
      insert into public.full_swing_contacts(file_hash,source_row,pitch_number,athlete_id,source_file,played_on,category,exit_velocity,launch_angle,direction,distance,imported_by)
      values(hash,row_number,pitch,target,source_name,played,kind,speed,angle,bearing,feet,auth.uid());
      created:=created+1;
    end if;
  end loop;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'full_swing_contacts_imported',jsonb_build_object('created',created,'unchanged',unchanged,'spatial_enriched',enriched));
  return jsonb_build_object('created',created,'unchanged',unchanged,'spatial_enriched',enriched);
end;
$$;
commit;
