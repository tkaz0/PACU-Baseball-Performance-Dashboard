-- Owner-requested October 9: every active signed-in account may see Players of the Week.
-- Narrow read-only projection for the weekly ranking only: current eligible 2026–27 names, PAC codes
-- and roster roles, plus each saved game-sheet version's count observations for those players
-- (RBI and any non-eligible identities removed). Peer profile ids are returned only to staff or to
-- the linked player for their own row. Snapshot table RLS, game_stats RLS and grants are unchanged.
begin;
create function public.team_game_week_inputs() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff boolean := private.has_role('admin') or private.has_role('coach');
  own uuid[] := array(select l.athlete_id from public.account_athletes l where l.user_id = (select auth.uid()));
  eligible text[];
begin
  if not (staff or (private.has_role('player') and cardinality(own) > 0)) then
    raise exception 'Linked player or staff account required' using errcode='42501';
  end if;
  select coalesce(array_agg(a.athlete_code), '{}') into eligible
    from public.athletes a join public.athlete_seasons s on s.athlete_id=a.id and s.season='2026-27'
    where s.roster_status is null or s.roster_status in ('active','redshirt');
  return jsonb_build_object(
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'code', a.athlete_code, 'name', coalesce(a.preferred_name, a.first_name) || ' ' || a.last_name,
        'player_type', s.player_type, 'primary_position', s.primary_position, 'secondary_position', s.secondary_position,
        'profile_id', case when staff or a.id = any(own) then a.id end) order by a.athlete_code), '[]'::jsonb)
      from public.athletes a join public.athlete_seasons s on s.athlete_id=a.id and s.season='2026-27'
      where s.roster_status is null or s.roster_status in ('active','redshirt')),
    'snapshots', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'source', v.source, 'fetched_at', v.fetched_at,
        'observations', (select coalesce(jsonb_agg(jsonb_build_object('athleteCode', o->'athleteCode', 'metric', o->'metric', 'value', o->'value',
            'unit', o->'unit', 'scope', o->'scope', 'eventId', o->'eventId')), '[]'::jsonb)
          from jsonb_array_elements(v.observations) o where o->>'athleteCode' = any(eligible) and o->>'metric' <> 'rbi'))
        order by v.fetched_at), '[]'::jsonb)
      from (select g.id, g.source, g.fetched_at, g.observations from public.game_stat_snapshots g order by g.fetched_at desc limit 60) v)
  );
end;
$$;
revoke all on function public.team_game_week_inputs() from public, anon, authenticated;
grant execute on function public.team_game_week_inputs() to authenticated;
notify pgrst,'reload schema';
commit;
