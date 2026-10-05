-- Owner-requested speed-up (October 5). Read policies check the caller's live role and
-- player link once per query (an InitPlan) instead of once per row. The rule is unchanged:
-- private.can_read_athlete(x) = active and (admin or coach or (player and linked to x)).
-- No data, grants to tables, roles, links or readers change.
begin;
create function private.reads_all_athletes() returns boolean language sql stable security definer set search_path='' as $$
  select private.has_role('admin') or private.has_role('coach');
$$;
create function private.linked_athlete_ids() returns uuid[] language sql stable security definer set search_path='' as $$
  select case when private.has_role('player') then coalesce((select array_agg(a.athlete_id) from public.account_athletes a
    where a.user_id=(select auth.uid())),'{}'::uuid[]) else '{}'::uuid[] end;
$$;
revoke all on function private.reads_all_athletes(), private.linked_athlete_ids() from public, anon, authenticated;
grant execute on function private.reads_all_athletes(), private.linked_athlete_ids() to authenticated;

alter policy athletes_read on public.athletes
  using ((select private.reads_all_athletes()) or id = any((select private.linked_athlete_ids())::uuid[]));
alter policy seasons_read on public.athlete_seasons
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy performance_measurements_read on public.performance_measurements
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy game_stats_athlete on public.game_stats
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy game_logs_read on public.game_logs
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy movement_own_or_staff on public.movement_screenings
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy athlete_headshots_read on public.athlete_headshots
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy contacts_own_or_staff on public.full_swing_contacts
  using ((select private.reads_all_athletes()) or athlete_id = any((select private.linked_athlete_ids())::uuid[]));
alter policy game_snapshots_staff on public.game_stat_snapshots
  using ((select private.reads_all_athletes()));

-- Likely-foul display views group contacts by player/file/date for every measurement read.
create index if not exists full_swing_contacts_foul_lookup on public.full_swing_contacts(athlete_id,file_hash,played_on,category);
commit;
