-- The owner authorizes minimal team leaderboard readings to all active players/staff.
-- Ordinary roster/history RLS remains Player-own. Only these checked projections broaden reads.
create function private.leaderboard_latest() returns table(
  athlete_id uuid, metric_key text, unit text, value float8, measured_at date,
  comparison_source text, period text, direction text, derived boolean
) language sql stable security invoker set search_path='' as $$
    with cohort as (
      select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
    ), raw as (
      select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric,false as derived
      from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
      where c.profile_metric and exists(select 1 from cohort where athlete_id=m.athlete_id)
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
      select periods.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
      from periods where period is not null
    ), latest as (select * from ranked where choice=1)
    select athlete_id,metric_key,unit,value,measured_at,comparison_source,period,direction,derived from latest
$$;
revoke all on function private.leaderboard_latest() from public,anon,authenticated;

create function private.leaderboard_options() returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
  if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then
    raise exception 'Active player or staff access required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('metricKey',x.metric_key,'source',x.comparison_source,
    'unit',x.unit,'period',x.period,'athleteCount',x.athlete_count)
    order by x.metric_key,x.period,x.comparison_source,x.unit),'[]'::jsonb) into result
  from (select metric_key,comparison_source,unit,period,count(*)::integer athlete_count
    from private.leaderboard_latest() group by metric_key,comparison_source,unit,period
    order by metric_key,period,comparison_source,unit limit 1001) x;
  if jsonb_array_length(result)>1000 then raise exception 'Leaderboard comparison limit exceeded' using errcode='22023'; end if;
  return result;
end;
$$;

create function private.team_leaderboard(p_metric_key text,p_source text,p_unit text,p_period text) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb; metric private.performance_metric_catalog;
begin
  if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then
    raise exception 'Active player or staff access required' using errcode='42501';
  end if;
  select * into metric from private.performance_metric_catalog where metric_key=p_metric_key and profile_metric;
  if metric.metric_key is null or p_source is null or length(p_source) not between 1 and 100
    or p_source<>lower(regexp_replace(btrim(p_source),'[[:space:]]+',' ','g')) or p_source ~ '[[:cntrl:]]'
    or p_period is null or p_period not in ('fall_2026','summer_2026') or (p_period='summer_2026' and not metric.body_metric)
    or not exists(select 1 from private.performance_metric_units where metric_key=p_metric_key and unit=p_unit) then
    raise exception 'Choose one valid leaderboard comparison' using errcode='22023';
  end if;
  with results as (
    select l.*,rank() over(order by case when metric.direction='lower' then l.value end asc,
      case when metric.direction<>'lower' then l.value end desc)::integer as place
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
  select coalesce(jsonb_agg(jsonb_build_object('rank',place,'athleteCode',athlete_code,'name',display_name,
    'jerseyNumber',jersey_number,'position',primary_position,'profileId',profile_id,
    'value',value,'measuredAt',measured_at,'source',comparison_source,'derived',derived)
    order by place,athlete_code),'[]'::jsonb) into result from limited;
  if jsonb_array_length(result)>1000 then raise exception 'Leaderboard athlete limit exceeded' using errcode='22023'; end if;
  return result;
end;
$$;
create function public.team_leaderboard_options() returns jsonb language sql stable security invoker set search_path='' as $$select private.leaderboard_options();$$;
create function public.team_leaderboard(p_metric_key text,p_source text,p_unit text,p_period text) returns jsonb language sql stable security invoker set search_path='' as $$select private.team_leaderboard(p_metric_key,p_source,p_unit,p_period);$$;
revoke all on function private.leaderboard_options(),private.team_leaderboard(text,text,text,text),public.team_leaderboard_options(),public.team_leaderboard(text,text,text,text) from public,anon,authenticated;
grant execute on function private.leaderboard_options(),private.team_leaderboard(text,text,text,text),public.team_leaderboard_options(),public.team_leaderboard(text,text,text,text) to authenticated;
