-- Owner-requested October 9: pitchers see the batted balls hit against them. Uses the existing
-- private pitcher links (202610090001). Returns only batted-ball readings, dates and session
-- category for contacts linked to the requested pitcher, to callers who may read that pitcher.
-- Batter identities, file identities and row coordinates never leave this function.
begin;
create function public.athlete_contacts_allowed(p_athlete_id uuid) returns table(played_on date, category text, exit_velocity double precision, launch_angle double precision, direction double precision, distance double precision, squared_up double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return query select c.played_on, c.category, c.exit_velocity, c.launch_angle, c.direction, c.distance, q.squared_up
    from private.full_swing_contact_pitchers p
    join public.full_swing_contacts c on c.file_hash=p.file_hash and c.source_row=p.source_row
    left join private.full_swing_contact_quality q on q.file_hash=c.file_hash and q.source_row=c.source_row
    where p.pitcher_athlete_id=p_athlete_id
    order by c.played_on, c.exit_velocity;
end;
$$;
revoke all on function public.athlete_contacts_allowed(uuid) from public, anon, authenticated;
grant execute on function public.athlete_contacts_allowed(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
