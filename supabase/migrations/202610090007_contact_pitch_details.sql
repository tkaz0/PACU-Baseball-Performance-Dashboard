-- Read-only exact-coordinate joins for hitter contact splits. Staff labels remain authoritative;
-- unknown labels stay unknown. No pitcher identity or private assignment document is returned.
begin;
create function public.athlete_contact_details(p_athlete uuid)
returns table(file_hash text, source_row integer, pitch_type text, pitcher_throws text,
  squared_up double precision, potential_exit_velocity double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete is null or not private.can_read_athlete(p_athlete) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return query select c.file_hash,c.source_row,
    case when label.item->>'pitchType' in ('Breaking Ball','Four-Seam Fastball','Two-Seam Fastball','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Splitter','Knuckleball','Other')
      then label.item->>'pitchType' end,
    case upper(btrim(s.throws)) when 'R' then 'R' when 'L' then 'L' end,
    q.squared_up,q.potential_exit_velocity
  from public.full_swing_contacts c
  left join private.full_swing_pitch_assignments a on a.file_hash=c.file_hash
  left join lateral (select item from pg_catalog.jsonb_array_elements(a.assignments) as items(item)
    where item->>'sourceRow'=c.source_row::text) label on true
  left join private.full_swing_contact_pitchers p on p.file_hash=c.file_hash and p.source_row=c.source_row
  left join public.athlete_seasons s on s.athlete_id=p.pitcher_athlete_id and s.season='2026-27'
  left join private.full_swing_contact_quality q on q.file_hash=c.file_hash and q.source_row=c.source_row
  where c.athlete_id=p_athlete;
end;
$$;
revoke all on function public.athlete_contact_details(uuid) from public, anon, authenticated;
grant execute on function public.athlete_contact_details(uuid) to authenticated;

-- Pitchers receive only contact readings against their own readable profile, never batter/file IDs.
create function public.athlete_contacts_allowed_by_pitch(p_athlete_id uuid)
returns table(played_on date, category text, exit_velocity double precision, launch_angle double precision,
  direction double precision, distance double precision, squared_up double precision,
  potential_exit_velocity double precision, pitch_type text)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return query select c.played_on,c.category,c.exit_velocity,c.launch_angle,c.direction,c.distance,
    q.squared_up,q.potential_exit_velocity,
    case when label.item->>'pitchType' in ('Breaking Ball','Four-Seam Fastball','Two-Seam Fastball','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Splitter','Knuckleball','Other')
      then label.item->>'pitchType' end
  from private.full_swing_contact_pitchers p
  join public.full_swing_contacts c on c.file_hash=p.file_hash and c.source_row=p.source_row
  left join private.full_swing_contact_quality q on q.file_hash=c.file_hash and q.source_row=c.source_row
  left join private.full_swing_pitch_assignments a on a.file_hash=c.file_hash
  left join lateral (select item from pg_catalog.jsonb_array_elements(a.assignments) as items(item)
    where item->>'sourceRow'=c.source_row::text) label on true
  where p.pitcher_athlete_id=p_athlete_id and c.category in ('game','intrasquad')
  order by c.played_on,c.exit_velocity;
end;
$$;
revoke all on function public.athlete_contacts_allowed_by_pitch(uuid) from public, anon, authenticated;
grant execute on function public.athlete_contacts_allowed_by_pitch(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
