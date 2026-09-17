-- Staff annotations for exact source CSV coordinates; no raw files or roster identities.
begin;
create table private.full_swing_pitch_assignments (
  file_hash text primary key check(file_hash ~ '^[a-f0-9]{64}$'),
  version integer not null check(version > 0),
  assignments jsonb not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table private.full_swing_pitch_assignments enable row level security;
revoke all on private.full_swing_pitch_assignments from public, anon, authenticated;

create function private.full_swing_pitch_labels(p_hash text, p_version integer default null, p_assignments jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare stored private.full_swing_pitch_assignments; item jsonb; normalized jsonb; source_row integer; seen integer[] := '{}';
begin
  -- Same authorization lock used by account changes and staff performance imports.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active administrator or coach required' using errcode='42501'; end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid file fingerprint' using errcode='22023'; end if;
  select * into stored from private.full_swing_pitch_assignments where file_hash=p_hash;
  if p_version is null and p_assignments is null then
    return jsonb_build_object('version',coalesce(stored.version,0),'assignments',coalesce(stored.assignments,'[]'::jsonb));
  end if;
  if p_version is null or p_version<0 or jsonb_typeof(p_assignments) is distinct from 'array' or jsonb_array_length(p_assignments)>5000 or octet_length(p_assignments::text)>500000 then raise exception 'Invalid reviewed pitch labels' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_assignments) loop
    if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>2
      or jsonb_typeof(item->'sourceRow') is distinct from 'number' or jsonb_typeof(item->'pitchType') is distinct from 'string'
      or item->>'pitchType' not in ('Fastball','Breaking Ball','Four-Seam Fastball','Two-Seam Fastball','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Splitter','Knuckleball','Other') then raise exception 'Invalid pitch label' using errcode='22023'; end if;
    if (item->>'sourceRow')::numeric not between 2 and 5001 or trunc((item->>'sourceRow')::numeric)<>(item->>'sourceRow')::numeric then raise exception 'Invalid pitch row' using errcode='22023'; end if;
    source_row:=(item->>'sourceRow')::integer;
    if source_row=any(seen) then raise exception 'Repeated pitch row' using errcode='22023'; end if;
    seen:=array_append(seen,source_row);
  end loop;
  select coalesce(jsonb_agg(value order by (value->>'sourceRow')::integer),'[]'::jsonb) into normalized from jsonb_array_elements(p_assignments);
  -- An identical retry is safe even if the prior save response was lost.
  if stored.file_hash is not null and stored.assignments=normalized then return jsonb_build_object('version',stored.version,'assignments',stored.assignments); end if;
  if p_version<>coalesce(stored.version,0) then raise exception 'Pitch labels changed; reload before saving' using errcode='40001'; end if;
  insert into private.full_swing_pitch_assignments(file_hash,version,assignments,updated_by)
    values(p_hash,1,normalized,auth.uid())
    on conflict(file_hash) do update set version=private.full_swing_pitch_assignments.version+1,assignments=excluded.assignments,updated_by=auth.uid(),updated_at=now()
    returning * into stored;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'pitch_labels_saved',jsonb_build_object('version',stored.version,'assignedCount',jsonb_array_length(normalized)));
  return jsonb_build_object('version',stored.version,'assignments',stored.assignments);
end;
$$;
revoke all on function private.full_swing_pitch_labels(text,integer,jsonb) from public, anon, authenticated;
grant execute on function private.full_swing_pitch_labels(text,integer,jsonb) to authenticated;
create function public.staff_full_swing_pitch_labels(p_hash text, p_version integer default null, p_assignments jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.full_swing_pitch_labels(p_hash,p_version,p_assignments); $$;
revoke all on function public.staff_full_swing_pitch_labels(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.staff_full_swing_pitch_labels(text,integer,jsonb) to authenticated;
commit;
