-- Owner-requested RHP/LHP splits (October 9). Full Swing exports rarely record PitcherThrows,
-- so each saved batted ball is linked to the roster pitcher staff already matched in the same
-- file. The link is accepted only when that file's saved Max Velocity summary row (the existing
-- reviewed pitcher match) has the exact value the original CSV produces, so no identity is
-- inferred from names. Pitcher identities stay private; readers return only R/L from the roster.
-- Contacts, measurements, accounts and existing grants are unchanged.
begin;
create table private.full_swing_contact_pitchers (
  file_hash text not null,
  source_row integer not null,
  pitcher_athlete_id uuid not null references public.athletes(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (file_hash, source_row),
  foreign key (file_hash, source_row) references public.full_swing_contacts(file_hash, source_row) on delete cascade
);
alter table private.full_swing_contact_pitchers enable row level security;
revoke all on private.full_swing_contact_pitchers from public, anon, authenticated;

create function public.save_full_swing_contact_pitchers(p_file_hash text, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; contact_row integer; summary_row integer; expected double precision; pitcher uuid; matches integer;
  prior uuid; created integer:=0; unchanged integer:=0; skipped integer:=0;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) not between 1 and 2000 or pg_catalog.octet_length(p_rows::text) > 500000 then
    raise exception 'Invalid pitcher link review' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r)) <> 3
      or exists(select 1 from jsonb_object_keys(r) k where k not in ('sourceRow','pitcherSummaryRow','pitcherMaxVelocity'))
      or jsonb_typeof(r->'sourceRow') is distinct from 'number' or r->>'sourceRow' !~ '^[0-9]{1,7}$'
      or jsonb_typeof(r->'pitcherSummaryRow') is distinct from 'number' or r->>'pitcherSummaryRow' !~ '^[0-9]{1,7}$'
      or jsonb_typeof(r->'pitcherMaxVelocity') is distinct from 'number' then
      raise exception 'Invalid pitcher link row' using errcode='22023';
    end if;
    contact_row := (r->>'sourceRow')::integer; summary_row := (r->>'pitcherSummaryRow')::integer;
    expected := (r->>'pitcherMaxVelocity')::double precision;
    if not exists(select 1 from public.full_swing_contacts c where c.file_hash=p_file_hash and c.source_row=contact_row) then
      skipped := skipped + 1; continue;
    end if;
    select count(distinct m.athlete_id), min(m.athlete_id::text)::uuid into matches, pitcher
      from public.performance_measurements m
      where m.file_hash=p_file_hash and m.source_row=summary_row and m.metric_key='max_pitch_velocity' and m.unit='mph'
        and m.source_sheet='CSV · Full Swing session summaries v1'
        and abs(m.value-expected) <= 0.00000001*greatest(1,abs(m.value));
    if matches <> 1 then skipped := skipped + 1; continue; end if;
    select p.pitcher_athlete_id into prior from private.full_swing_contact_pitchers p where p.file_hash=p_file_hash and p.source_row=contact_row;
    if prior is null then
      insert into private.full_swing_contact_pitchers(file_hash,source_row,pitcher_athlete_id,linked_by) values(p_file_hash,contact_row,pitcher,auth.uid());
      created := created + 1;
    elsif prior = pitcher then unchanged := unchanged + 1;
    else raise exception 'Saved pitcher link differs; review the original CSV' using errcode='23505';
    end if;
  end loop;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'full_swing_contact_pitchers_linked',jsonb_build_object('created',created,'unchanged',unchanged,'skipped',skipped));
  return jsonb_build_object('created',created,'unchanged',unchanged,'skipped',skipped);
end;
$$;

-- Only the pitcher's roster throwing hand leaves this reader, for contacts the caller may read.
create function public.athlete_contact_pitcher_hands(p_athlete uuid) returns table(file_hash text, source_row integer, pitcher_throws text)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete is null or not private.can_read_athlete(p_athlete) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return query select c.file_hash, c.source_row,
    case upper(btrim(s.throws)) when 'R' then 'R' when 'L' then 'L' end
    from public.full_swing_contacts c
    join private.full_swing_contact_pitchers p on p.file_hash=c.file_hash and p.source_row=c.source_row
    left join public.athlete_seasons s on s.athlete_id=p.pitcher_athlete_id and s.season='2026-27'
    where c.athlete_id=p_athlete;
end;
$$;
revoke all on function public.save_full_swing_contact_pitchers(text,jsonb), public.athlete_contact_pitcher_hands(uuid) from public, anon, authenticated;
grant execute on function public.save_full_swing_contact_pitchers(text,jsonb), public.athlete_contact_pitcher_hands(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
