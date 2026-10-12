-- Owner-requested October 12: players may see their own Pitch+ (Team).
-- Staff loading Pitch Grades publish one aggregate-only baseline row: pooled team strike rates per
-- pitch family, pooled contact-against averages, and per-pitch-type velocity/spin/speed-gap spreads
-- (n, mean, sd) only for pitch types with at least five pitchers, so no teammate's value can be
-- worked out. No pitcher identities, counts by pitcher or raw readings are stored. Players grade
-- only their own inputs against it; other readers, RLS and grants are unchanged.
begin;
create table public.pitch_grade_baselines (
  id smallint primary key default 1 check (id = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_catalog.octet_length(payload::text) <= 20000),
  computed_at timestamptz not null default now(),
  computed_by uuid not null references auth.users(id) on delete restrict
);
alter table public.pitch_grade_baselines enable row level security;
revoke all on public.pitch_grade_baselines from public, anon, authenticated;
grant select on public.pitch_grade_baselines to authenticated;
create policy pitch_grade_baselines_read on public.pitch_grade_baselines for select to authenticated
  using ((select private.has_role('admin')) or (select private.has_role('coach')) or (select private.has_role('player')));

create function public.staff_save_pitch_grade_baselines(p_payload jsonb) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare t record; d record; saved timestamptz;
begin
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or pg_catalog.octet_length(p_payload::text) > 20000
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('teamStrike','contact','types'))
    or jsonb_typeof(p_payload->'teamStrike') is distinct from 'object' or jsonb_typeof(p_payload->'contact') is distinct from 'object'
    or jsonb_typeof(p_payload->'types') is distinct from 'object'
    or exists(select 1 from jsonb_each(p_payload->'teamStrike') e where e.key not in ('fb','bb_pitch_family','ch') or jsonb_typeof(e.value) <> 'number' or (e.value)::text::numeric not between 0 and 1)
    or exists(select 1 from jsonb_each(p_payload->'contact') e where e.key not in ('ev','hard','squared') or jsonb_typeof(e.value) not in ('number','null')) then
    raise exception 'Invalid pitch grade baselines' using errcode='22023';
  end if;
  for t in select key, value from jsonb_each(p_payload->'types') loop
    if t.key !~ '^[A-Za-z -]{1,40}$' or jsonb_typeof(t.value) <> 'object' then raise exception 'Invalid pitch type baseline' using errcode='22023'; end if;
    for d in select key, value from jsonb_each(t.value) loop
      if d.key not in ('velocity','spin','velocityGap') or jsonb_typeof(d.value) <> 'object'
        or exists(select 1 from jsonb_object_keys(d.value) k where k not in ('n','mean','sd'))
        or jsonb_typeof(d.value->'n') <> 'number' or (d.value->>'n')::numeric < 5
        or jsonb_typeof(d.value->'mean') <> 'number' or jsonb_typeof(d.value->'sd') <> 'number' or (d.value->>'sd')::numeric < 0 then
        raise exception 'Pitch type spreads need five or more pitchers' using errcode='22023';
      end if;
    end loop;
  end loop;
  insert into public.pitch_grade_baselines(id, payload, computed_at, computed_by) values (1, p_payload, now(), auth.uid())
    on conflict (id) do update set payload = excluded.payload, computed_at = excluded.computed_at, computed_by = excluded.computed_by
    returning computed_at into saved;
  return saved;
end;
$$;
revoke all on function public.staff_save_pitch_grade_baselines(jsonb) from public, anon, authenticated;
grant execute on function public.staff_save_pitch_grade_baselines(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
