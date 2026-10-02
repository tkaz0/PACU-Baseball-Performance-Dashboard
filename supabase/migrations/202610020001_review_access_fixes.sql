-- Narrow team photos to the same current cohort as signed-in team boards.
-- Invitation recovery reviews the original attempted recipient, even after a roster correction.
begin;
create or replace function private.team_headshots() returns table(athlete_code text, image_path text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.has_role('admin') or private.has_role('coach') or
    (private.has_role('player') and exists(select 1 from public.account_athletes l where l.user_id = (select auth.uid())))) then
    raise exception 'Linked player or staff account required' using errcode = '42501';
  end if;
  return query select a.athlete_code, h.image_path
    from public.athlete_headshots h join public.athletes a on a.id = h.athlete_id
    where exists(select 1 from public.athlete_seasons s where s.athlete_id = a.id and s.season = '2026-27'
      and (s.roster_status is null or s.roster_status in ('active','redshirt')));
end;
$$;
revoke all on function private.team_headshots(), public.team_headshots() from public, anon, authenticated;
grant execute on function private.team_headshots(), public.team_headshots() to authenticated;

create or replace function private.player_invite_history() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'athlete_id',athlete_id,'status',status,'email',email) order by created_at),'[]'::jsonb) from private.player_invite_attempts);
end;
$$;
revoke all on function private.player_invite_history(), public.admin_player_invite_attempts() from public, anon, authenticated;
grant execute on function private.player_invite_history(), public.admin_player_invite_attempts() to authenticated;
commit;
