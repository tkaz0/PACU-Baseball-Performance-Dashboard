-- Owner request (October 12): staff record each Fall Ball (BDL) game-week date in the dashboard
-- instead of in code. Dates name Players of the Week, Week by Week columns and change badges, and
-- count weeks for qualified minimums. Readable by active signed-in accounts; staff-only writes.
begin;
create table public.fall_ball_weeks (
  week integer primary key check (week between 1 and 12),
  played_on date not null check (played_on between date '2026-09-01' and date '2026-12-31'),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.fall_ball_weeks enable row level security;
revoke all on public.fall_ball_weeks from public, anon, authenticated;
grant select on public.fall_ball_weeks to authenticated;
create policy fall_ball_weeks_read on public.fall_ball_weeks for select to authenticated
  using (private.has_role('admin') or private.has_role('coach') or private.has_role('player'));

create function public.staff_set_fall_ball_week(p_week integer, p_played_on date) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_week is null or p_week not between 1 and 12 then raise exception 'Week must be 1-12' using errcode='22023'; end if;
  if p_played_on is null then
    delete from public.fall_ball_weeks where week=p_week;
  else
    if p_played_on not between date '2026-09-01' and date '2026-12-31' then raise exception 'Date must be in Fall 2026' using errcode='22023'; end if;
    -- Weeks stay in date order so "Week N" always means the Nth game week.
    if exists (select 1 from public.fall_ball_weeks w where (w.week < p_week and w.played_on >= p_played_on) or (w.week > p_week and w.played_on <= p_played_on)) then
      raise exception 'Week dates must increase with the week number' using errcode='22023';
    end if;
    insert into public.fall_ball_weeks(week, played_on, updated_by) values (p_week, p_played_on, auth.uid())
      on conflict (week) do update set played_on=excluded.played_on, updated_by=excluded.updated_by, updated_at=now();
  end if;
  insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'fall_ball_week_set',jsonb_build_object('week',p_week,'played_on',p_played_on));
end;
$$;
revoke all on function public.staff_set_fall_ball_week(integer, date) from public, anon, authenticated;
grant execute on function public.staff_set_fall_ball_week(integer, date) to authenticated;

-- Owner-confirmed dates so far; the first save keeps the earliest admin as the recorder.
insert into public.fall_ball_weeks(week, played_on, updated_by)
select v.week, v.played_on, (select r.user_id from public.account_roles r where r.role='admin' order by r.user_id limit 1)
from (values (1, date '2026-09-12'), (2, date '2026-09-26'), (3, date '2026-10-10')) as v(week, played_on)
where exists (select 1 from public.account_roles r where r.role='admin');
notify pgrst,'reload schema';
commit;
