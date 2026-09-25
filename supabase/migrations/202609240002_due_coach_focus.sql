begin;
create function private.staff_due_focus_items(p_through date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_through is null or p_through not between date '2026-09-01' and date '2027-12-31' then
    raise exception 'Invalid review date';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',f.id,'athleteId',f.athlete_id,
    'playerName',coalesce(a.preferred_name,a.first_name)||' '||a.last_name,
    'title',f.title,'targetDate',f.target_date
  ) order by f.target_date,a.last_name,a.first_name,f.id)
  from public.coach_focus_items f join public.athletes a on a.id=f.athlete_id
  where f.completed_at is null and f.target_date is not null and f.target_date<=p_through), '[]'::jsonb);
end;
$$;
create function public.staff_due_focus_items(p_through date) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.staff_due_focus_items(p_through);
$$;
revoke all on function private.staff_due_focus_items(date),public.staff_due_focus_items(date) from public,anon,authenticated;
grant execute on function private.staff_due_focus_items(date),public.staff_due_focus_items(date) to authenticated;
commit;
