begin;
-- Reviewed, paired batted-ball events. The existing summary metrics remain unchanged.
create table public.full_swing_contacts (
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  source_row integer not null check (source_row between 2 and 1000000),
  pitch_number integer not null check (pitch_number > 0),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  source_file text not null check (length(source_file) between 1 and 300),
  played_on date not null check (played_on between date '2026-09-01' and date '2026-12-31'),
  category text not null check (category in ('game','intrasquad','practice')),
  exit_velocity double precision not null check (exit_velocity > 0 and exit_velocity <= 200),
  launch_angle double precision not null check (launch_angle between -90 and 90),
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  primary key (file_hash,source_row),
  unique (file_hash,pitch_number)
);
create index full_swing_contacts_athlete_date on public.full_swing_contacts(athlete_id,played_on desc,source_row);
alter table public.full_swing_contacts enable row level security;
revoke all on public.full_swing_contacts from public,anon,authenticated;
grant select on public.full_swing_contacts to authenticated;
create policy contacts_own_or_staff on public.full_swing_contacts for select to authenticated
  using (private.can_read_athlete(athlete_id));

create function private.import_full_swing_contacts(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; target uuid; prior public.full_swing_contacts; created integer:=0; unchanged integer:=0;
  row_number integer; pitch integer; speed double precision; angle double precision; played date; hash text;
  source_name text; kind text; reviewed_code text;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if jsonb_typeof(p_rows) is distinct from 'array' or pg_catalog.octet_length(p_rows::text)>1000000 or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'Invalid contact review';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or
      (select array_agg(key order by key) from jsonb_object_keys(r) key) is distinct from array['athleteCode','category','exitVelocity','fileHash','launchAngle','pitchNumber','playedOn','sourceFile','sourceRow'] or
      jsonb_typeof(r->'athleteCode') is distinct from 'string' or r->>'athleteCode' !~ '^PAC-[0-9]{4,6}$' or
      jsonb_typeof(r->'fileHash') is distinct from 'string' or r->>'fileHash' !~ '^[a-f0-9]{64}$' or
      jsonb_typeof(r->'sourceFile') is distinct from 'string' or length(r->>'sourceFile') not between 1 and 300 or btrim(r->>'sourceFile')<>(r->>'sourceFile') or (r->>'sourceFile') ~ '[[:cntrl:]]' or
      jsonb_typeof(r->'sourceRow') is distinct from 'number' or r->>'sourceRow' !~ '^[0-9]{1,7}$' or
      jsonb_typeof(r->'pitchNumber') is distinct from 'number' or r->>'pitchNumber' !~ '^[0-9]{1,7}$' or
      jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-(09|10|11|12)-[0-9]{2}$' or
      jsonb_typeof(r->'category') is distinct from 'string' or r->>'category' not in ('game','intrasquad','practice') or
      jsonb_typeof(r->'exitVelocity') is distinct from 'number' or jsonb_typeof(r->'launchAngle') is distinct from 'number' or
      r->>'exitVelocity' !~ '^[0-9]+(\.[0-9]+)?$' or r->>'launchAngle' !~ '^-?[0-9]+(\.[0-9]+)?$' then
      raise exception 'Invalid contact row';
    end if;
    row_number:=(r->>'sourceRow')::integer; pitch:=(r->>'pitchNumber')::integer;
    speed:=(r->>'exitVelocity')::double precision; angle:=(r->>'launchAngle')::double precision;
    played:=(r->>'playedOn')::date; hash:=r->>'fileHash';source_name:=r->>'sourceFile';kind:=r->>'category';reviewed_code:=r->>'athleteCode';
    if row_number<2 or pitch<1 or speed<=0 or speed>200 or angle not between -90 and 90 or played not between date '2026-09-01' and date '2026-12-31' then raise exception 'Invalid contact value'; end if;
    select a.id into target from public.athletes a where a.athlete_code=reviewed_code;
    if target is null then raise exception 'Unknown reviewed athlete'; end if;
    select * into prior from public.full_swing_contacts where file_hash=hash and source_row=row_number;
    if prior.file_hash is not null then
      if prior.athlete_id<>target or prior.pitch_number<>pitch or prior.source_file<>source_name or prior.played_on<>played or prior.category<>kind or prior.exit_velocity<>speed or prior.launch_angle<>angle then
        raise exception 'Source contact changed; review required';
      end if;
      unchanged:=unchanged+1;
    else
      insert into public.full_swing_contacts(file_hash,source_row,pitch_number,athlete_id,source_file,played_on,category,exit_velocity,launch_angle,imported_by)
      values(hash,row_number,pitch,target,source_name,played,kind,speed,angle,auth.uid());
      created:=created+1;
    end if;
  end loop;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'full_swing_contacts_imported',jsonb_build_object('created',created,'unchanged',unchanged));
  return jsonb_build_object('created',created,'unchanged',unchanged);
end;
$$;
revoke all on function private.import_full_swing_contacts(jsonb) from public,anon,authenticated;
grant execute on function private.import_full_swing_contacts(jsonb) to authenticated;
create function public.staff_import_full_swing_contacts(p_rows jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.import_full_swing_contacts(p_rows); $$;
revoke all on function public.staff_import_full_swing_contacts(jsonb) from public,anon,authenticated;
grant execute on function public.staff_import_full_swing_contacts(jsonb) to authenticated;
commit;
