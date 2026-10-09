-- Owner-requested October 9 Power Development view: staff need Squared Up beside each hitter's
-- saved batted balls. Active Admin/Coach only; returns contact coordinates and the saved Squared Up
-- value, which staff can already pair with the staff-readable full_swing_contacts rows. Players get nothing new.
begin;
create function public.team_contact_quality() returns table(file_hash text, source_row integer, squared_up double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  return query select q.file_hash, q.source_row, q.squared_up from private.full_swing_contact_quality q;
end;
$$;
revoke all on function public.team_contact_quality() from public, anon, authenticated;
grant execute on function public.team_contact_quality() to authenticated;
notify pgrst,'reload schema';
commit;
