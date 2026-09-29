-- Staff-visible check receipts are separate from saved measurement and game-stat receipts.
-- A check records that the reviewed source was inspected; it never imports observations.
create table public.weekly_source_checks (
  source text primary key check (source in ('qpa_fall_2026','pitching_fall_2026','player_metrics')),
  outcome text not null check (outcome in ('completed','needs_review','failed')),
  checked_at timestamptz not null default statement_timestamp(),
  checked_by uuid not null references auth.users(id)
);
alter table public.weekly_source_checks enable row level security;
revoke all on public.weekly_source_checks from public, anon, authenticated;
grant select on public.weekly_source_checks to authenticated;
create policy weekly_source_checks_staff on public.weekly_source_checks
  for select to authenticated using (private.has_role('admin') or private.has_role('coach'));

create function private.record_weekly_source_check(p_source text, p_outcome text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.weekly_source_checks%rowtype;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff access required' using errcode='42501';
  end if;
  if p_source is null or p_source not in ('qpa_fall_2026','pitching_fall_2026','player_metrics')
    or p_outcome is null or p_outcome not in ('completed','needs_review','failed') then
    raise exception 'Invalid source check' using errcode='22023';
  end if;
  insert into public.weekly_source_checks(source,outcome,checked_at,checked_by)
    values(p_source,p_outcome,pg_catalog.statement_timestamp(),(select auth.uid()))
    on conflict (source) do update set outcome=excluded.outcome,checked_at=excluded.checked_at,checked_by=excluded.checked_by
    returning * into saved;
  return pg_catalog.jsonb_build_object('source',saved.source,'outcome',saved.outcome,'checkedAt',saved.checked_at);
end;
$$;
create function public.record_weekly_source_check(p_source text, p_outcome text)
returns jsonb language sql security invoker set search_path='' as $$
  select private.record_weekly_source_check(p_source,p_outcome);
$$;
revoke all on function private.record_weekly_source_check(text,text), public.record_weekly_source_check(text,text) from public, anon, authenticated;
grant execute on function private.record_weekly_source_check(text,text), public.record_weekly_source_check(text,text) to authenticated;
