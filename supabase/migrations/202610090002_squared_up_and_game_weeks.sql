-- Owner-requested October 9 additions.
-- (1) Squared Up % and Potential Exit Velocity per saved batted ball. Full Swing exports record
--     SquaredUp (0–1: how close the contact came to the bat's full potential) and PotExitSpeed
--     (mph possible from that bat speed and pitch velocity at 100% squared up). A value is accepted
--     only for an existing saved contact whose stored ExitSpeed equals the CSV value the browser sends.
--     Saved values are immutable; contacts, measurements, accounts and grants are unchanged.
-- (2) A read-only own-player view of saved game-sheet versions for week-by-week profile trends.
--     It returns only the requested athlete's observations from each saved version, to callers who
--     may already read that athlete. Snapshot table RLS (staff only) is unchanged.
begin;
create table private.full_swing_contact_quality (
  file_hash text not null,
  source_row integer not null,
  squared_up double precision not null check (squared_up > 0 and squared_up <= 1),
  potential_exit_velocity double precision not null check (potential_exit_velocity > 0 and potential_exit_velocity <= 200),
  saved_by uuid not null references auth.users(id) on delete restrict,
  saved_at timestamptz not null default now(),
  primary key (file_hash, source_row),
  foreign key (file_hash, source_row) references public.full_swing_contacts(file_hash, source_row) on delete cascade
);
alter table private.full_swing_contact_quality enable row level security;
revoke all on private.full_swing_contact_quality from public, anon, authenticated;

create function public.save_full_swing_contact_quality(p_file_hash text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; contact_row integer; ev double precision; sq double precision; pot double precision;
  saved double precision; prior_sq double precision; prior_pot double precision; created integer:=0; unchanged integer:=0; skipped integer:=0;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) not between 1 and 2000 or pg_catalog.octet_length(p_rows::text) > 500000 then
    raise exception 'Invalid squared-up review' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r)) <> 4
      or exists(select 1 from jsonb_object_keys(r) k where k not in ('sourceRow','exitVelocity','squaredUp','potentialExitVelocity'))
      or jsonb_typeof(r->'sourceRow') is distinct from 'number' or r->>'sourceRow' !~ '^[0-9]{1,7}$'
      or jsonb_typeof(r->'exitVelocity') is distinct from 'number' or jsonb_typeof(r->'squaredUp') is distinct from 'number'
      or jsonb_typeof(r->'potentialExitVelocity') is distinct from 'number' then
      raise exception 'Invalid squared-up row' using errcode='22023';
    end if;
    contact_row := (r->>'sourceRow')::integer; ev := (r->>'exitVelocity')::double precision;
    sq := (r->>'squaredUp')::double precision; pot := (r->>'potentialExitVelocity')::double precision;
    if not (sq > 0 and sq <= 1 and pot > 0 and pot <= 200) then raise exception 'Squared-up values out of range' using errcode='22023'; end if;
    select c.exit_velocity into saved from public.full_swing_contacts c where c.file_hash=p_file_hash and c.source_row=contact_row;
    if saved is null or abs(saved-ev) > 0.00000001*greatest(1,abs(saved)) then skipped := skipped + 1; continue; end if;
    select q.squared_up, q.potential_exit_velocity into prior_sq, prior_pot from private.full_swing_contact_quality q where q.file_hash=p_file_hash and q.source_row=contact_row;
    if prior_sq is null then
      insert into private.full_swing_contact_quality(file_hash,source_row,squared_up,potential_exit_velocity,saved_by) values(p_file_hash,contact_row,sq,pot,auth.uid());
      created := created + 1;
    elsif prior_sq = sq and prior_pot = pot then unchanged := unchanged + 1;
    else raise exception 'Saved squared-up value differs; review the original CSV' using errcode='23505';
    end if;
  end loop;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'full_swing_contact_quality_saved',jsonb_build_object('created',created,'unchanged',unchanged,'skipped',skipped));
  return jsonb_build_object('created',created,'unchanged',unchanged,'skipped',skipped);
end;
$$;

create function public.athlete_contact_quality(p_athlete uuid) returns table(file_hash text, source_row integer, squared_up double precision, potential_exit_velocity double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete is null or not private.can_read_athlete(p_athlete) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return query select c.file_hash, c.source_row, q.squared_up, q.potential_exit_velocity
    from public.full_swing_contacts c
    join private.full_swing_contact_quality q on q.file_hash=c.file_hash and q.source_row=c.source_row
    where c.athlete_id=p_athlete;
end;
$$;

create function public.athlete_game_snapshot_history(p_athlete_id uuid) returns table(id uuid, source text, fetched_at timestamptz, observations jsonb)
language plpgsql stable security definer set search_path='' as $$
declare code text;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  select a.athlete_code into code from public.athletes a where a.id=p_athlete_id;
  return query select s.id, s.source, s.fetched_at,
    coalesce((select jsonb_agg(o) from jsonb_array_elements(s.observations) o where o->>'athleteCode' = code), '[]'::jsonb)
    from public.game_stat_snapshots s
    order by s.fetched_at desc
    limit 60;
end;
$$;

revoke all on function public.save_full_swing_contact_quality(text,jsonb), public.athlete_contact_quality(uuid), public.athlete_game_snapshot_history(uuid) from public, anon, authenticated;
grant execute on function public.save_full_swing_contact_quality(text,jsonb), public.athlete_contact_quality(uuid), public.athlete_game_snapshot_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
