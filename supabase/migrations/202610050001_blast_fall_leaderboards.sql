begin;
-- Display-only Fall Blast projection. Reuse the existing cohort/weekly completeness
-- contract; do not change stored observations, accounts, RLS or public reader grants.
create function private.blast_bat_speed_fall() returns table(
  athlete_id uuid,value float8,measured_at date,swing_count bigint
) language sql stable security invoker set search_path='' as $$
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

  ) select athlete_id,value,last_date::date,swings::bigint from player_blast
$$;
revoke all on function private.blast_bat_speed_fall() from public,anon,authenticated;

do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.leaderboard_latest()'::regprocedure);
  if position('from ranked where choice=1' in definition)=0 then
    raise exception 'Reviewed leaderboard reader shape changed';
  end if;
  definition:=replace(definition,'from ranked where choice=1',
    'from ranked where choice=1 and comparison_source !~ ''^blast motion · average · ''
     union all select athlete_id,''avg_bat_speed'',''mph'',value,measured_at,
       ''blast motion · fall average'',''fall_2026'',''higher'',true from private.blast_bat_speed_fall()');
  execute definition;
  definition:=pg_get_functiondef('private.team_leaderboard(text,text,text,text)'::regprocedure);
  if position('case when fall_samples.n>0 then fall_samples.n' in definition)=0
    or position('case when fall_samples.n>0 then case' in definition)=0
    or position('from limited l' in definition)=0 then
    raise exception 'Reviewed sample reader shape changed';
  end if;
  definition:=replace(definition,'case when fall_samples.n>0 then fall_samples.n',
    'case when blast_samples.swing_count>0 then blast_samples.swing_count when fall_samples.n>0 then fall_samples.n');
  definition:=replace(definition,'case when fall_samples.n>0 then case',
    'case when blast_samples.swing_count>0 then ''swings'' when fall_samples.n>0 then case');
  definition:=replace(definition,'from limited l',
    'from limited l left join private.blast_bat_speed_fall() blast_samples
       on blast_samples.athlete_id=l.athlete_id and l.metric_key=''avg_bat_speed''
       and l.unit=''mph'' and l.comparison_source=''blast motion · fall average'' and l.period=''fall_2026''');
  execute definition;
end;
$$;
notify pgrst,'reload schema';
commit;
