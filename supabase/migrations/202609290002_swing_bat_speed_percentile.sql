-- Own-player Fall Blast rank only. No peer identities, report data, or data writes.
create function private.athlete_blast_bat_speed_percentile(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  -- Match the existing hitting-team-average report completeness and overlap guards.
  with blast as (
    select m.*,split_part(split_part(m.source,' · ',3),':',1) as start_date,
      split_part(split_part(m.source,' · ',3),':',2) as end_date
    from public.performance_measurements m
    where m.source ~ '^Blast Motion · Average · 2026-[0-9]{2}-[0-9]{2}:2026-[0-9]{2}-[0-9]{2}$'
      and exists(select 1 from public.athlete_seasons s where s.athlete_id=m.athlete_id and s.season='2026-27'
        and (s.roster_status is null or s.roster_status in ('active','redshirt')))
  ), reports as (
    select athlete_id,source,start_date,end_date,
      max(value) filter(where metric_key='blast_swing_count' and unit='count') as swings,
      count(*) filter(where metric_key='blast_swing_count' and unit='count')=1
      and count(distinct file_hash)=1 and count(*)=count(distinct (metric_key,unit))
      and bool_and(measured_at::text=end_date) and start_date>='2026-09-01' and end_date<='2026-12-31' and start_date<=end_date
      and start_date ~ '^2026-(09|10|11|12)-(0[1-9]|[12][0-9]|3[01])$'
      and not (substring(start_date,6,2) in ('09','11') and substring(start_date,9,2)='31') as valid
    from blast group by athlete_id,source,start_date,end_date
  ), valid_athletes as (
    select r.athlete_id,count(*) as report_count,sum(r.swings::numeric) as swings,
      min(r.start_date) as first_date,max(r.end_date) as last_date
    from reports r group by r.athlete_id
    having bool_and(r.valid and coalesce(r.swings>0 and r.swings=trunc(r.swings),false))
      and sum(r.swings::numeric)<=9007199254740991
      and not exists(select 1 from reports a join reports b on a.athlete_id=b.athlete_id and a.source<b.source
        and a.start_date<=b.end_date and b.start_date<=a.end_date where a.athlete_id=r.athlete_id)
  ), player_blast as (
    -- Numeric intermediates avoid overflow when multiplying finite readings by counts.
    select b.athlete_id,(sum(b.value::numeric*r.swings::numeric)/v.swings)::float8 as value,
      v.swings,v.report_count,v.first_date,v.last_date
    from blast b join reports r on r.athlete_id=b.athlete_id and r.source=b.source join valid_athletes v on v.athlete_id=b.athlete_id
    where b.metric_key='avg_bat_speed' and b.unit='mph' and b.value>=0
      and b.value not in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
    group by b.athlete_id,v.swings,v.report_count,v.first_date,v.last_date
    having count(*)=v.report_count
  ), own_result as (
    select own.*,stats.n,stats.below,stats.equal
    from player_blast own cross join lateral (
      select count(*)::integer as n,count(*) filter(where peer.value<own.value)::integer as below,
        count(*) filter(where peer.value=own.value)::integer as equal
      from player_blast peer
    ) stats where own.athlete_id=p_athlete_id
  )
  select jsonb_build_object('athleteId',athlete_id,'observedValue',value,
    'percentile',case when n>=5 then 100.0*(below+(equal-1)/2.0)/(n-1) else null end,
    'sampleSize',n,'swingCount',swings,'reportCount',report_count,'firstDate',first_date,'lastDate',last_date)
    into result from own_result;
  return result;
end;
$$;

create function public.athlete_blast_bat_speed_percentile(p_athlete_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.athlete_blast_bat_speed_percentile(p_athlete_id);$$;
revoke all on function private.athlete_blast_bat_speed_percentile(uuid),public.athlete_blast_bat_speed_percentile(uuid) from public,anon,authenticated;
grant execute on function private.athlete_blast_bat_speed_percentile(uuid),public.athlete_blast_bat_speed_percentile(uuid) to authenticated;
