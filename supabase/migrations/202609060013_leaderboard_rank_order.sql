-- Owner-requested numerical leaderboard order. Profile metrics remain neutral.
-- Preserve the existing signed-in projection, coherent comparisons and tied ranks.
create or replace function private.team_leaderboard(p_metric_key text,p_source text,p_unit text,p_period text) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb; metric private.performance_metric_catalog; rank_direction text;
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
  -- Leaderboard ordering is separate from neutral profile percentile/insight semantics.
  rank_direction := case when p_metric_key='body_fat_pct' then 'lower'
    when p_metric_key in ('height','muscle_mass_pct') then 'higher'
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
  select coalesce(jsonb_agg(jsonb_build_object('rank',place,'athleteCode',athlete_code,'name',display_name,
    'jerseyNumber',jersey_number,'position',primary_position,'profileId',profile_id,
    'value',value,'measuredAt',measured_at,'source',comparison_source,'derived',derived)
    order by place,athlete_code),'[]'::jsonb) into result from limited;
  if jsonb_array_length(result)>1000 then raise exception 'Leaderboard athlete limit exceeded' using errcode='22023'; end if;
  return result;
end;
$$;

revoke all on function private.team_leaderboard(text,text,text,text) from public,anon,authenticated;
grant execute on function private.team_leaderboard(text,text,text,text) to authenticated;
