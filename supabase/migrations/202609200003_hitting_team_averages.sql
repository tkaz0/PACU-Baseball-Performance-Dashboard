-- Aggregate-only comparisons. No peer identities, reports, account changes or writes.
create function private.hitting_team_averages() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then
    raise exception 'Active player or staff access required' using errcode='42501';
  end if;
  with full_swing as (
    select metric_key,unit,comparison_source as source,avg(value) as value,count(*) as athletes,
      min(measured_at)::text as first_date,max(measured_at)::text as last_date
    from private.leaderboard_latest()
    where period='fall_2026' and comparison_source in ('full swing · game','full swing · intrasquad','full swing · practice','full swing · hitting')
      and metric_key in ('max_exit_velocity','avg_exit_velocity','bat_speed','max_bat_speed','avg_bat_speed','smash_factor','max_distance')
    group by metric_key,unit,comparison_source
  ), blast as (
    select m.*,split_part(split_part(m.source,' · ',3),':',1) as start_date,
      split_part(split_part(m.source,' · ',3),':',2) as end_date
    from public.performance_measurements m
    where m.source ~ '^Blast Motion · Average · 2026-[0-9]{2}-[0-9]{2}:2026-[0-9]{2}-[0-9]{2}$'
      and exists(select 1 from public.athlete_seasons s where s.athlete_id=m.athlete_id and s.season='2026-27' and (s.roster_status is null or s.roster_status in ('active','redshirt')))
  ), reports as (
    select athlete_id,source,start_date,end_date,
      max(value) filter(where metric_key='blast_swing_count' and unit='count') as swings,
      count(*) filter(where metric_key='blast_swing_count' and unit='count')=1
      and count(distinct file_hash)=1 and count(*)=count(distinct (metric_key,unit))
      and bool_and(measured_at::text=end_date) and start_date>='2026-09-01' and end_date<='2026-12-31' and start_date<=end_date as valid
    from blast group by athlete_id,source,start_date,end_date
  ), valid_athletes as (
    select r.athlete_id,count(*) as report_count,sum(r.swings) as swings,min(r.start_date) as first_date,max(r.end_date) as last_date
    from reports r group by r.athlete_id
    having bool_and(r.valid and coalesce(r.swings>0 and r.swings=trunc(r.swings),false))
      and sum(r.swings)<=9007199254740991
      and not exists(select 1 from reports a join reports b on a.athlete_id=b.athlete_id and a.source<b.source
        and a.start_date<=b.end_date and b.start_date<=a.end_date where a.athlete_id=r.athlete_id)
  ), player_blast as (
    select b.athlete_id,b.metric_key,b.unit,sum(b.value*r.swings)/v.swings as value,v.swings,v.first_date,v.last_date
    from blast b join reports r on r.athlete_id=b.athlete_id and r.source=b.source join valid_athletes v on v.athlete_id=b.athlete_id
    where (b.metric_key in ('avg_bat_speed','blast_peak_hand_speed') and b.unit='mph' and b.value>=0)
      or (b.metric_key in ('blast_attack_angle','blast_early_connection','blast_vertical_bat_angle') and b.unit='deg')
    group by b.athlete_id,b.metric_key,b.unit,v.swings,v.report_count,v.first_date,v.last_date
    having count(*)=v.report_count
  ), team_blast as (
    select metric_key,unit,sum(value*swings)/sum(swings) as value,count(*) as athletes,sum(swings) as swings,min(first_date) as first_date,max(last_date) as last_date
    from player_blast group by metric_key,unit
  ), combined as (
    select jsonb_build_object('metricKey',metric_key,'unit',unit,'source',source,'method','player_mean','value',value,'athleteCount',athletes,'swingCount',null,'firstDate',first_date,'lastDate',last_date) as item from full_swing
    union all
    select jsonb_build_object('metricKey',metric_key,'unit',unit,'source','blast_fall','method','swing_weighted','value',value,'athleteCount',athletes,'swingCount',swings,'firstDate',first_date,'lastDate',last_date) from team_blast
  ) select coalesce(jsonb_agg(item order by item->>'source',item->>'metricKey',item->>'unit'),'[]'::jsonb) into result from combined;
  return result;
end;
$$;
create function public.hitting_team_averages() returns jsonb language sql stable security invoker set search_path='' as $$select private.hitting_team_averages();$$;
revoke all on function private.hitting_team_averages(),public.hitting_team_averages() from public,anon,authenticated;
grant execute on function private.hitting_team_averages(),public.hitting_team_averages() to authenticated;
