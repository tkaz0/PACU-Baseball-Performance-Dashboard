-- Fall best max values on team leaderboards only. Player profiles retain the latest-session view and history.
-- Exact source, session category, unit and Fall period partitions remain separate.
create or replace function private.leaderboard_latest() returns table(
  athlete_id uuid, metric_key text, unit text, value float8, measured_at date,
  comparison_source text, period text, direction text, derived boolean
) language sql stable security invoker set search_path='' as $$
    with cohort as (
      select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
    ), raw as (
      select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric,false as derived
      from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
      where (c.profile_metric or c.metric_key='muscle_mass' or (c.metric_key in ('classified_max_velocity','classified_avg_velocity','classified_max_spin','classified_avg_spin') and m.source ~ '^Full Swing · (Game|Intrasquad|Practice) · (Fastball|Breaking Ball|Four-Seam Fastball|Two-Seam Fastball|Sinker|Cutter|Slider|Sweeper|Curveball|Changeup|Splitter|Knuckleball|Other)$')) and exists(select 1 from cohort where athlete_id=m.athlete_id)
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
      select raw.*,case when measured_at between '2026-09-01'::date and '2026-12-31'::date then 'fall_2026'
        when body_metric and measured_at between '2026-06-01'::date and '2026-08-31'::date then 'summer_2026' end as period,
        lower(regexp_replace(btrim(source),'[[:space:]]+',' ','g')) as comparison_source
      from raw
    ), ranked as (
      -- Browser Date timestamps have millisecond precision; use the same tie boundary.
      select periods.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by case when metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then value end asc,case when metric_key in ('max_exit_velocity','max_bat_speed','max_distance','max_pitch_velocity','infield_velocity','outfield_velocity','classified_max_velocity','classified_max_spin') then value end desc,measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
      from periods where period is not null
    ), latest as (select * from ranked where choice=1)
    select athlete_id,metric_key,unit,value,measured_at,comparison_source,period,direction,derived from latest
$$;
