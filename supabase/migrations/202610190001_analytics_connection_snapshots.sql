-- Owner-requested October 19: Analytics "Key Connections" tracks a fixed list of stat pairs week by week.
-- Staff loading Analytics record one aggregate row per pair per Pacific Monday-start week: Pearson r and
-- the number of paired players. No player identities or individual values are stored. Staff read only.
begin;
create table public.analytics_connection_snapshots (
  week_start date not null check (extract(isodow from week_start) = 1),
  pair_key text not null check (pair_key ~ '^[a-z0-9_]{1,60}$'),
  r numeric check (r between -1 and 1),
  n integer not null check (n between 0 and 500),
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  primary key (week_start, pair_key)
);
alter table public.analytics_connection_snapshots enable row level security;
revoke all on public.analytics_connection_snapshots from public, anon, authenticated;
grant select on public.analytics_connection_snapshots to authenticated;
create policy analytics_connection_snapshots_read on public.analytics_connection_snapshots for select to authenticated
  using ((select private.has_role('admin')) or (select private.has_role('coach')));

create function public.staff_save_connection_snapshots(p_week_start date, p_rows jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare saved integer;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1
    or p_week_start > (pg_catalog.now() at time zone 'America/Los_Angeles')::date
    or p_week_start < (pg_catalog.now() at time zone 'America/Los_Angeles')::date - 6
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 40
    or exists(select 1 from jsonb_array_elements(p_rows) e where jsonb_typeof(e) <> 'object'
      or exists(select 1 from jsonb_object_keys(e) k where k not in ('pair','r','n'))
      or jsonb_typeof(e->'pair') <> 'string' or (e->>'pair') !~ '^[a-z0-9_]{1,60}$'
      or jsonb_typeof(e->'n') <> 'number' or (e->>'n')::numeric not between 0 and 500 or (e->>'n')::numeric <> trunc((e->>'n')::numeric)
      or jsonb_typeof(e->'r') not in ('number','null') or (jsonb_typeof(e->'r') = 'number' and (e->>'r')::numeric not between -1 and 1)) then
    raise exception 'Invalid connection snapshot' using errcode='22023';
  end if;
  insert into public.analytics_connection_snapshots(week_start, pair_key, r, n, recorded_at, recorded_by)
    select p_week_start, e->>'pair', (e->>'r')::numeric, (e->>'n')::integer, now(), auth.uid() from jsonb_array_elements(p_rows) e
    on conflict (week_start, pair_key) do update set r = excluded.r, n = excluded.n, recorded_at = excluded.recorded_at, recorded_by = excluded.recorded_by
      where public.analytics_connection_snapshots.r is distinct from excluded.r or public.analytics_connection_snapshots.n is distinct from excluded.n;
  get diagnostics saved = row_count;
  return saved;
end;
$$;
revoke all on function public.staff_save_connection_snapshots(date, jsonb) from public, anon, authenticated;
grant execute on function public.staff_save_connection_snapshots(date, jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
