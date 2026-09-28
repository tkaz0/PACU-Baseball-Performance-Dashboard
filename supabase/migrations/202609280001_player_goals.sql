begin;

-- Explicit coach targets, separate from immutable source observations and free-text focus.
create table public.player_numeric_goals (
  id uuid primary key,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  title text not null check(length(title) between 1 and 100 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  metric_key text not null,
  metric_label text not null,
  source text not null,
  unit text not null,
  period text not null default 'fall_2026' check(period='fall_2026'),
  baseline_observation_id text not null,
  baseline_value float8 not null,
  baseline_date date not null check(baseline_date between date '2026-09-01' and date '2026-12-31'),
  target_value float8 not null check(target_value not in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) and target_value<>baseline_value),
  target_date date,
  staff_note text check(length(staff_note)<=600 and staff_note !~ '[[:cntrl:]]'),
  shared_with_player boolean not null default false,
  completed_at timestamptz,
  completed_value float8,
  completed_date date,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(metric_key,unit) references private.performance_metric_units(metric_key,unit)
);
create index player_numeric_goals_athlete on public.player_numeric_goals(athlete_id,completed_at,created_at desc);
alter table public.player_numeric_goals enable row level security;
revoke all on public.player_numeric_goals from public,anon,authenticated;

create function private.player_goal_metric(p_key text) returns boolean
language sql immutable set search_path='' as $$
  select p_key=any(array['height','weight','grip_strength','grip_dominant','grip_non_dominant','body_fat_pct','muscle_mass','body_score',
    'max_exit_velocity','avg_exit_velocity','bat_speed','max_bat_speed','avg_bat_speed','smash_factor','max_distance',
    'home_to_first','home_to_second','boxer_t','steal_start_12ft','max_pitch_velocity','avg_pitch_velocity','avg_fastball_spin',
    'infield_velocity','outfield_velocity','classified_avg_velocity','classified_max_velocity','classified_avg_spin','classified_max_spin']);
$$;

create function private.read_player_numeric_goals(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff boolean; goals jsonb; choices jsonb; today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete goal access denied' using errcode='42501'; end if;
  staff:=private.has_role('admin') or private.has_role('coach');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'athleteId',g.athlete_id,'title',g.title,'metricKey',g.metric_key,'metricLabel',g.metric_label,'source',g.source,'unit',g.unit,'period',g.period,
    'baselineValue',g.baseline_value,'baselineDate',g.baseline_date,'baselineValid',baseline.id is not null,
    'targetValue',g.target_value,'targetDate',g.target_date,'staffNote',case when staff then g.staff_note else null end,'shared',g.shared_with_player,
    'completedAt',g.completed_at,'revision',g.revision,'createdAt',g.created_at,
    'currentValue',case when baseline.id is null then null when g.completed_at is not null then g.completed_value else coalesce(latest.value,g.baseline_value) end,
    'currentDate',case when baseline.id is null then null when g.completed_at is not null then g.completed_date else coalesce(latest.measured_at,g.baseline_date) end
  ) order by (g.completed_at is not null),g.created_at desc,g.id),'[]'::jsonb) into goals
  from public.player_numeric_goals g
  left join public.performance_measurements baseline on baseline.observation_id=g.baseline_observation_id and baseline.athlete_id=g.athlete_id
    and baseline.metric_key=g.metric_key and baseline.source=g.source and baseline.unit=g.unit and baseline.value=g.baseline_value and baseline.measured_at=g.baseline_date
  left join lateral (
    select m.value,m.measured_at from public.performance_measurements m where m.athlete_id=g.athlete_id and m.metric_key=g.metric_key
      and m.source=g.source and m.unit=g.unit and m.measured_at>g.baseline_date and m.measured_at<=least(today,date '2026-12-31')
    order by m.measured_at desc,m.imported_at desc,m.file_hash,m.observation_id limit 1
  ) latest on true
  where g.athlete_id=p_athlete_id and (staff or g.shared_with_player);
  if jsonb_array_length(goals)>100 then raise exception 'Goal history limit exceeded'; end if;
  choices:='[]'::jsonb;
  if staff then
    select coalesce(jsonb_agg(jsonb_build_object('observationId',m.observation_id,'metricKey',m.metric_key,'metricLabel',c.metric_label,
      'source',m.source,'unit',m.unit,'value',m.value,'measuredAt',m.measured_at) order by c.metric_label,m.source,m.unit),'[]'::jsonb) into choices
    from (select distinct on(metric_key,source,unit) * from public.performance_measurements
      where athlete_id=p_athlete_id and private.player_goal_metric(metric_key) and source !~* '^blast'
        and measured_at between date '2026-09-01' and least(today,date '2026-12-31')
      order by metric_key,source,unit,measured_at desc,imported_at desc,file_hash,observation_id) m
    join private.performance_metric_catalog c on c.metric_key=m.metric_key;
    if jsonb_array_length(choices)>500 then raise exception 'Goal measurement choice limit exceeded'; end if;
  end if;
  return jsonb_build_object('goals',goals,'choices',choices);
end;
$$;
create function public.athlete_numeric_goals(p_athlete_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.read_player_numeric_goals(p_athlete_id);$$;

create function private.save_player_numeric_goal(p_athlete_id uuid,p_goal_id uuid,p_expected_revision integer,p_baseline_observation_id text,p_baseline_value float8,
  p_title text,p_target_value float8,p_target_date date,p_staff_note text,p_shared boolean,p_completed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.player_numeric_goals; baseline public.performance_measurements; definition private.performance_metric_catalog;
  clean_title text:=btrim(coalesce(p_title,'')); clean_note text:=nullif(btrim(coalesce(p_staff_note,'')),'');
  latest_value float8; latest_date date; result_revision integer; today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
  -- Same account -> roster lock order as reviewed measurements and corrections.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  if p_athlete_id is null or p_goal_id is null or not exists(select 1 from public.athletes where id=p_athlete_id)
    or p_expected_revision is null or p_expected_revision<0 or p_shared is null or p_completed is null
    or length(clean_title) not between 1 and 100 or clean_title ~ '[[:cntrl:]]' or length(coalesce(clean_note,''))>600 or clean_note ~ '[[:cntrl:]]'
    or p_target_value is null or p_target_value in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) or p_target_value<0 or p_target_value>1000000000
    or (p_target_date is not null and p_target_date not between date '2026-09-01' and date '2026-12-31') then raise exception 'Invalid goal' using errcode='22023'; end if;
  select * into existing from public.player_numeric_goals where id=p_goal_id for update;
  if (existing.id is null and p_expected_revision<>0) or (existing.id is not null and (existing.athlete_id<>p_athlete_id or existing.revision<>p_expected_revision)) then
    raise exception 'Goal changed; refresh before saving' using errcode='40001';
  end if;
  if existing.id is null then
    if p_completed or p_baseline_value is null or p_baseline_observation_id is null or length(p_baseline_observation_id)>2000 then raise exception 'Choose a recorded baseline' using errcode='22023'; end if;
    select * into baseline from public.performance_measurements where observation_id=p_baseline_observation_id and athlete_id=p_athlete_id for share;
    if baseline.id is null or baseline.value<>p_baseline_value or not private.player_goal_metric(baseline.metric_key) or baseline.source ~* '^blast'
      or baseline.measured_at not between date '2026-09-01' and least(today,date '2026-12-31') then raise exception 'Baseline changed or unavailable; refresh' using errcode='40001'; end if;
    if (select count(*) from public.player_numeric_goals where athlete_id=p_athlete_id)>=100 then raise exception 'Goal history limit reached' using errcode='22023'; end if;
  else
    -- Editing cannot silently switch metric, source, period or the starting reading.
    if p_baseline_observation_id is not null or p_baseline_value is not null then raise exception 'Existing goal baseline cannot change' using errcode='22023'; end if;
    baseline.metric_key:=existing.metric_key;baseline.unit:=existing.unit;baseline.source:=existing.source;baseline.value:=existing.baseline_value;baseline.measured_at:=existing.baseline_date;
  end if;
  select * into definition from private.performance_metric_catalog where metric_key=baseline.metric_key;
  if definition.metric_key is null or p_target_value=baseline.value or (definition.positive_only and p_target_value<=0)
    or (definition.percentage and p_target_value>100) or (p_target_date is not null and p_target_date<baseline.measured_at) then raise exception 'Target must differ from the baseline and use the recorded unit' using errcode='22023'; end if;
  if not p_completed and (existing.id is null or existing.completed_at is not null) and
    (select count(*) from public.player_numeric_goals where athlete_id=p_athlete_id and completed_at is null)>=4 then raise exception 'Complete a goal before adding another' using errcode='22023'; end if;
  if existing.id is null then
    insert into public.player_numeric_goals(id,athlete_id,title,metric_key,metric_label,source,unit,baseline_observation_id,baseline_value,baseline_date,target_value,target_date,staff_note,shared_with_player,created_by)
    values(p_goal_id,p_athlete_id,clean_title,baseline.metric_key,definition.metric_label,baseline.source,baseline.unit,baseline.observation_id,baseline.value,baseline.measured_at,p_target_value,p_target_date,clean_note,p_shared,auth.uid()) returning revision into result_revision;
  else
    if p_completed and existing.completed_at is null then
      select value,measured_at into latest_value,latest_date from public.performance_measurements where athlete_id=p_athlete_id and metric_key=existing.metric_key
        and source=existing.source and unit=existing.unit and measured_at>existing.baseline_date and measured_at<=least(today,date '2026-12-31')
        order by measured_at desc,imported_at desc,file_hash,observation_id limit 1;
      latest_value:=coalesce(latest_value,existing.baseline_value); latest_date:=coalesce(latest_date,existing.baseline_date);
    end if;
    update public.player_numeric_goals set title=clean_title,target_value=p_target_value,target_date=p_target_date,staff_note=clean_note,shared_with_player=p_shared,
      completed_at=case when p_completed then coalesce(existing.completed_at,now()) else null end,
      completed_value=case when p_completed then coalesce(existing.completed_value,latest_value) else null end,
      completed_date=case when p_completed then coalesce(existing.completed_date,latest_date) else null end,
      revision=revision+1,updated_at=now() where id=p_goal_id returning revision into result_revision;
  end if;
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'player_numeric_goal_saved',p_athlete_id,
    jsonb_build_object('goal_id',p_goal_id,'revision',result_revision,'shared',p_shared,'completed',p_completed));
  return jsonb_build_object('id',p_goal_id,'revision',result_revision);
end;
$$;
create function public.staff_save_numeric_goal(p_athlete_id uuid,p_goal_id uuid,p_expected_revision integer,p_baseline_observation_id text,p_baseline_value float8,
  p_title text,p_target_value float8,p_target_date date,p_staff_note text,p_shared boolean,p_completed boolean) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_player_numeric_goal(p_athlete_id,p_goal_id,p_expected_revision,p_baseline_observation_id,p_baseline_value,p_title,p_target_value,p_target_date,p_staff_note,p_shared,p_completed); $$;
revoke all on function private.player_goal_metric(text),private.read_player_numeric_goals(uuid),public.athlete_numeric_goals(uuid),
  private.save_player_numeric_goal(uuid,uuid,integer,text,float8,text,float8,date,text,boolean,boolean),
  public.staff_save_numeric_goal(uuid,uuid,integer,text,float8,text,float8,date,text,boolean,boolean) from public,anon,authenticated;
grant execute on function private.read_player_numeric_goals(uuid),public.athlete_numeric_goals(uuid),
  private.save_player_numeric_goal(uuid,uuid,integer,text,float8,text,float8,date,text,boolean,boolean),
  public.staff_save_numeric_goal(uuid,uuid,integer,text,float8,text,float8,date,text,boolean,boolean) to authenticated;
commit;
