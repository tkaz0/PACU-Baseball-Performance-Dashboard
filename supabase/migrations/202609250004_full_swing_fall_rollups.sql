-- Leaderboard-only Fall rollups: best saved max, and a reading-count-weighted mean
-- only when every contributing Full Swing session has a verified sample count.
create or replace function private.leaderboard_latest() returns table(
  athlete_id uuid, metric_key text, unit text, value float8, measured_at date,
  comparison_source text, period text, direction text, derived boolean
) language sql stable security invoker set search_path='' as $$
  with cohort as (
    select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
  ), raw as (
    select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric,false as derived
    from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
    where (c.profile_metric or c.metric_key='muscle_mass' or (c.metric_key in ('classified_max_velocity','classified_avg_velocity','classified_max_spin','classified_avg_spin') and m.source ~ '^Full Swing · (Game|Intrasquad|Practice) · (Fastball|Breaking Ball|Four-Seam Fastball|Two-Seam Fastball|Sinker|Cutter|Slider|Sweeper|Curveball|Changeup|Splitter|Knuckleball|Other)$'))
      and exists(select 1 from cohort where athlete_id=m.athlete_id)
    union all
    select muscle.athlete_id,'muscle_mass_pct','%',100.0::float8*(muscle.value/weight.value),muscle.measured_at,muscle.source,muscle.file_hash,
      muscle.observation_id,greatest(muscle.imported_at,weight.imported_at),'neutral',true,true
    from public.performance_measurements muscle join public.performance_measurements weight
      on weight.athlete_id=muscle.athlete_id and weight.file_hash=muscle.file_hash and weight.measured_at=muscle.measured_at and weight.unit=muscle.unit
    where muscle.metric_key='muscle_mass' and weight.metric_key='weight' and muscle.source='RENPHO' and weight.source='RENPHO'
      and muscle.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$' and weight.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$'
      and weight.value>0 and muscle.value<=weight.value
      and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='weight' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
      and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='muscle_mass' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
      and exists(select 1 from cohort where athlete_id=muscle.athlete_id)
      and not exists(select 1 from public.performance_measurements explicit where explicit.athlete_id=muscle.athlete_id and explicit.file_hash=muscle.file_hash and explicit.measured_at=muscle.measured_at and explicit.metric_key='muscle_mass_pct'
        and explicit.source='RENPHO' and explicit.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')
  ), periods as (
    select raw.*,case when measured_at between date '2026-09-01' and date '2026-12-31' then 'fall_2026'
      when body_metric and measured_at between date '2026-06-01' and date '2026-08-31' then 'summer_2026' end as period,
      lower(regexp_replace(btrim(source),'[[:space:]]+',' ','g')) as comparison_source from raw
  ), sampled as (
    select p.*,coalesce(s.sample_count::float8,c.n) as n from periods p
    left join private.full_swing_session_samples s on s.file_hash=p.file_hash and s.athlete_id=p.athlete_id
      and s.metric_key=p.metric_key and s.unit=p.unit
    left join lateral (
      select case when count(*)=1 then max(m.value) end as n from public.performance_measurements m
      where m.athlete_id=p.athlete_id and m.file_hash=p.file_hash and m.measured_at=p.measured_at and m.source=p.source
        and m.metric_key=case when p.metric_key='classified_avg_velocity' then 'classified_velocity_count'
          when p.metric_key='classified_avg_spin' then 'classified_spin_count' else '' end and m.unit='count'
    ) c on true
    where p.period='fall_2026' and p.metric_key in ('avg_exit_velocity','avg_bat_speed','avg_pitch_velocity','classified_avg_velocity','classified_avg_spin')
      and p.comparison_source ~ '^full swing · (game|intrasquad|practice)( · .+)?$'
  ), rollups as (
    select athlete_id,metric_key,unit,sum(value*n)/sum(n) as value,max(measured_at) as measured_at,
      min(source) as source,min(file_hash) as file_hash,'fall-weighted-average'::text as observation_id,
      max(imported_at) as imported_at,min(direction) as direction,false as body_metric,true as derived,
      period,comparison_source
    from sampled group by athlete_id,metric_key,unit,period,comparison_source
    having count(*)=count(n) and count(*)=count(distinct file_hash) and bool_and(n>0 and n=trunc(n))
      and sum(n)>0
  ), chosen as (
    select p.* from periods p where not exists (
      select 1 from rollups r where r.athlete_id=p.athlete_id and r.metric_key=p.metric_key and r.unit=p.unit
        and r.period=p.period and r.comparison_source=p.comparison_source)
    union all select * from rollups
  ), ranked as (
    select chosen.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by
      case when metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then value end asc,
      case when metric_key in ('max_exit_velocity','max_bat_speed','max_distance','max_pitch_velocity','infield_velocity','outfield_velocity','classified_max_velocity','classified_max_spin') then value end desc,
      measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
    from chosen where period is not null
  )
  select athlete_id,metric_key,unit,value,measured_at,comparison_source,period,direction,derived from ranked where choice=1
$$;
