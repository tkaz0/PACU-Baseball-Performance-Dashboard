-- Separate timed protocols; preserve original observations and ordinary-session authorization.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('steal_start_12ft','12 ft Steal Start','lower',false,true,true,false),
('steal_reaction','Steal Reaction','lower',false,true,true,false),
('steal_12_42ft','Steal Start · 12–42 ft','lower',false,true,true,false);
insert into private.performance_metric_units(metric_key,unit) values ('steal_start_12ft','s'),('steal_reaction','s'),('steal_12_42ft','s');

create or replace function private.performance_summary(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
  return (
    with cohort as (
      select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
    ), raw as (
      select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric
      from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
      where c.profile_metric and (m.athlete_id=p_athlete_id or exists(select 1 from cohort where athlete_id=m.athlete_id))
      union all
      select muscle.athlete_id,'muscle_mass_pct','%',100.0::float8*(muscle.value/weight.value),muscle.measured_at,muscle.source,muscle.file_hash,
        muscle.observation_id,greatest(muscle.imported_at,weight.imported_at),'neutral',true
      from public.performance_measurements muscle join public.performance_measurements weight
        on weight.athlete_id=muscle.athlete_id and weight.file_hash=muscle.file_hash and weight.measured_at=muscle.measured_at and weight.unit=muscle.unit
      where muscle.metric_key='muscle_mass' and weight.metric_key='weight' and muscle.source='RENPHO' and weight.source='RENPHO'
        and muscle.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$' and weight.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$'
        and weight.value>0 and muscle.value<=weight.value
        and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='weight' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
        and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='muscle_mass' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
        and (muscle.athlete_id=p_athlete_id or exists(select 1 from cohort where athlete_id=muscle.athlete_id))
        and not exists(select 1 from public.performance_measurements explicit where explicit.athlete_id=muscle.athlete_id and explicit.file_hash=muscle.file_hash and explicit.measured_at=muscle.measured_at and explicit.metric_key='muscle_mass_pct'
          and explicit.source='RENPHO' and explicit.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')
    ), periods as (
      select raw.*,case when measured_at between '2026-09-01'::date and '2026-12-31'::date then 'fall_2026'
        when body_metric and measured_at between '2026-06-01'::date and '2026-08-31'::date then 'summer_2026' end as period,
        lower(regexp_replace(btrim(source),'[[:space:]]+',' ','g')) as comparison_source
      from raw
    ), ranked as (
      -- Browser Date timestamps have millisecond precision; use the same tie boundary.
      select periods.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by case when metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then value end asc,measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
      from periods where period is not null
    ), latest as (select * from ranked where choice=1), summaries as (
      select own.*,stats.n,stats.below,stats.equal
      from latest own cross join lateral (
        select count(*)::integer as n,count(*) filter(where peer.value<own.value)::integer as below,count(*) filter(where peer.value=own.value)::integer as equal
        from latest peer join cohort on cohort.athlete_id=peer.athlete_id
        where peer.metric_key=own.metric_key and peer.unit=own.unit and peer.period=own.period and peer.comparison_source=own.comparison_source
      ) stats where own.athlete_id=p_athlete_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'metricKey',metric_key,'measuredAt',measured_at,'observedValue',value,'unit',unit,'source',source,'period',period,'direction',direction,'sampleSize',n,
      'value',case when n>=5 and exists(select 1 from cohort where athlete_id=p_athlete_id) then
        case when direction='lower' then 100.0-100.0*(below+(equal-1)/2.0)/(n-1) else 100.0*(below+(equal-1)/2.0)/(n-1) end else null end
    ) order by period,metric_key,unit,comparison_source),'[]'::jsonb) from summaries
  );
end;
$$;

create or replace function private.leaderboard_latest() returns table(
  athlete_id uuid, metric_key text, unit text, value float8, measured_at date,
  comparison_source text, period text, direction text, derived boolean
) language sql stable security invoker set search_path='' as $$
    with cohort as (
      select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
    ), raw as (
      select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric,false as derived
      from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
      where (c.profile_metric or c.metric_key='muscle_mass') and exists(select 1 from cohort where athlete_id=m.athlete_id)
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
      select periods.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by case when metric_key in ('home_to_first','home_to_second','steal_break','boxer_t','steal_start_12ft','steal_reaction','steal_12_42ft') then value end asc,measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
      from periods where period is not null
    ), latest as (select * from ranked where choice=1)
    select athlete_id,metric_key,unit,value,measured_at,comparison_source,period,direction,derived from latest
$$;
revoke all on function private.leaderboard_latest() from public,anon,authenticated;


