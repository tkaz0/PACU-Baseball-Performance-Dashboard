-- Keep fallback sample counts inside the exact source/pitch-family comparison.
-- A missing or ambiguous count stays unknown; another pitch family is never a substitute.
create or replace function private.team_leaderboard(p_metric_key text,p_source text,p_unit text,p_period text) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb; metric private.performance_metric_catalog; rank_direction text;
begin
  if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then
    raise exception 'Active player or staff access required' using errcode='42501';
  end if;
  select * into metric from private.performance_metric_catalog where metric_key=p_metric_key and (profile_metric or metric_key='muscle_mass' or metric_key in ('classified_max_velocity','classified_avg_velocity','classified_max_spin','classified_avg_spin'));
  if metric.metric_key is null or p_source is null or length(p_source) not between 1 and 100
    or p_source<>lower(regexp_replace(btrim(p_source),'[[:space:]]+',' ','g')) or p_source ~ '[[:cntrl:]]'
    or p_period is null or p_period not in ('fall_2026','summer_2026') or (p_period='summer_2026' and not metric.body_metric)
    or not exists(select 1 from private.performance_metric_units where metric_key=p_metric_key and unit=p_unit) then
    raise exception 'Choose one valid leaderboard comparison' using errcode='22023';
  end if;
  -- Leaderboard ordering is separate from neutral profile percentile/insight semantics.
  rank_direction := case when p_metric_key='body_fat_pct' then 'lower'
    when p_metric_key in ('height','muscle_mass_pct','muscle_mass') then 'higher'
    when metric.direction='lower' then 'lower' else 'higher' end;
  with results as (
    select l.*,rank() over(order by case when rank_direction='lower' then l.value end asc,
      case when rank_direction<>'lower' then l.value end desc)::integer as place
    from private.leaderboard_latest() l
    where l.metric_key=p_metric_key and l.comparison_source=p_source and l.unit=p_unit and l.period=p_period
  ), limited as (
    select r.*,a.athlete_code,concat_ws(' ',coalesce(nullif(a.preferred_name,''),a.first_name),a.last_name) display_name,
      s.jersey_number,s.primary_position,
      case when private.can_read_athlete(a.id) then a.id else null end profile_id
    from results r join public.athletes a on a.id=r.athlete_id
    join public.athlete_seasons s on s.athlete_id=r.athlete_id and s.season='2026-27'
    order by r.place,a.athlete_code limit 1001
  )
  select coalesce(jsonb_agg(jsonb_build_object('rank',l.place,'athleteCode',l.athlete_code,'name',l.display_name,
    'jerseyNumber',l.jersey_number,'position',l.primary_position,'profileId',l.profile_id,
    'value',l.value,'measuredAt',l.measured_at,'source',l.comparison_source,'derived',l.derived,
    'sampleCount',case when fall_samples.n>0 then fall_samples.n when classified_samples.n>0 then classified_samples.n when samples.value>0 and samples.value=trunc(samples.value) then samples.value::integer
      when l.metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then trials.n else null end,
    'sampleUnit',case when fall_samples.n>0 then case when l.metric_key in ('max_pitch_velocity','avg_pitch_velocity') then 'pitches' else 'swings' end
      when classified_samples.n>0 then 'pitches' when samples.value>0 and samples.value=trunc(samples.value) then
      case when l.metric_key like 'classified_%' then 'pitches' else 'swings' end
      when l.metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then 'trials' else null end)
    order by l.place,l.athlete_code),'[]'::jsonb) into result
  from limited l
  left join lateral (
    select sum(s.sample_count)::integer as n from public.performance_measurements m
    left join private.full_swing_session_samples s on s.file_hash=m.file_hash and s.athlete_id=m.athlete_id
      and s.metric_key=m.metric_key and s.unit=m.unit
    where m.athlete_id=l.athlete_id and m.metric_key=l.metric_key and m.unit=l.unit
      and lower(regexp_replace(btrim(m.source),'[[:space:]]+',' ','g'))=l.comparison_source
      and m.measured_at between date '2026-09-01' and date '2026-12-31'
      and l.period='fall_2026' and l.metric_key in ('max_exit_velocity','avg_exit_velocity','max_bat_speed','avg_bat_speed','max_distance','max_pitch_velocity','avg_pitch_velocity')
    having count(*)=count(s.sample_count) and count(*)=count(distinct m.file_hash)
  ) fall_samples on true
  left join lateral (
    select sum(c.n)::integer as n from public.performance_measurements m
    left join lateral (
      select case when count(*)=1 then max(x.value) end as n from public.performance_measurements x
      where x.athlete_id=m.athlete_id and x.file_hash=m.file_hash and x.measured_at=m.measured_at and x.source=m.source
        and x.metric_key=case when l.metric_key in ('classified_avg_velocity','classified_max_velocity') then 'classified_velocity_count'
          when l.metric_key in ('classified_avg_spin','classified_max_spin') then 'classified_spin_count' else '' end and x.unit='count'
    ) c on true
    where m.athlete_id=l.athlete_id and m.metric_key=l.metric_key and m.unit=l.unit
      and lower(regexp_replace(btrim(m.source),'[[:space:]]+',' ','g'))=l.comparison_source
      and m.measured_at between date '2026-09-01' and date '2026-12-31'
      and l.period='fall_2026' and l.metric_key in ('classified_avg_velocity','classified_max_velocity','classified_avg_spin','classified_max_spin')
    having count(*)=count(c.n) and count(*)=count(distinct m.file_hash) and bool_and(c.n>0 and c.n=trunc(c.n))
  ) classified_samples on true
  left join lateral (
    select m.file_hash from public.performance_measurements m
    where m.athlete_id=l.athlete_id and m.metric_key=l.metric_key and m.unit=l.unit
      and m.value=l.value and m.measured_at=l.measured_at
      and lower(regexp_replace(btrim(m.source),'[[:space:]]+',' ','g'))=l.comparison_source
    order by date_trunc('milliseconds',m.imported_at) desc,m.file_hash asc,m.observation_id asc limit 1
  ) selected on true
  left join lateral (
    select case when count(*)=1 then max(c.value) end as value from public.performance_measurements c
    where c.athlete_id=l.athlete_id and c.file_hash=selected.file_hash and c.measured_at=l.measured_at
      and lower(regexp_replace(btrim(c.source),'[[:space:]]+',' ','g'))=l.comparison_source
      and c.metric_key=case when l.metric_key in ('classified_avg_velocity','classified_max_velocity') then 'classified_velocity_count'
        when l.metric_key in ('classified_avg_spin','classified_max_spin') then 'classified_spin_count'
        when l.comparison_source like 'blast%' then 'blast_swing_count' else '' end
      and c.unit='count'
  ) samples on true
  left join lateral (
    select count(*)::integer as n from public.performance_measurements t
    where t.athlete_id=l.athlete_id and t.metric_key=l.metric_key and t.unit=l.unit
      and lower(regexp_replace(btrim(t.source),'[[:space:]]+',' ','g'))=l.comparison_source
      and ((l.period='fall_2026' and t.measured_at between date '2026-09-01' and date '2026-12-31')
        or (l.period='summer_2026' and t.measured_at between date '2026-06-01' and date '2026-08-31'))
  ) trials on true;
  if jsonb_array_length(result)>1000 then raise exception 'Leaderboard athlete limit exceeded' using errcode='22023'; end if;
  return result;
end;
$$;
