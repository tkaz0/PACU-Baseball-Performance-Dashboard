-- Add exact outs derived from owner-confirmed baseball innings.
insert into private.game_metric_columns values ('pitching_fall_2026','innings_outs',18),('pitching_fall_2026','earned_runs',26);
create or replace function private.import_game_snapshot(p_source text,p_hash text,p_fetched_at text,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' set extra_float_digits=3 as $$
declare r jsonb; a uuid; snapshot uuid; fetched timestamptz; previous public.game_stat_snapshots; duplicate public.game_stat_snapshots; metric_column integer; is_rate boolean; numerator jsonb; denominator jsonb; field text;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active import staff required' using errcode='42501'; end if;
 if p_source not in ('qpa_fall_2026','pitching_fall_2026') or p_source is null or p_hash is null or length(p_hash)<>64 or p_hash !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 10000 or octet_length(p_rows::text)>1048576 then raise exception 'Invalid bounded game snapshot' using errcode='22023'; end if;
 begin fetched:=p_fetched_at::timestamptz; exception when others then raise exception 'Invalid source timestamp' using errcode='22023'; end;
 if fetched is null or not isfinite(fetched) or fetched<'2026-09-12T00:00:00-07:00'::timestamptz then raise exception 'Game sync starts September 12, 2026' using errcode='22023'; end if;
 if fetched>private.game_sync_now()+interval '5 minutes' then raise exception 'The source timestamp is in the future' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x group by x->>'athleteCode',x->>'eventId',x->>'metric' having count(*)>1) then raise exception 'Duplicate source athlete/metric/event' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x group by x->>'athleteCode',x->>'eventId' having count(distinct x->>'sourceRow')>1)
  or exists(select 1 from jsonb_array_elements(p_rows) x where x->>'eventId' is not null group by x->>'eventId' having count(distinct x->>'playedOn')>1) then raise exception 'Conflicting source row or event date' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>10 or exists(select 1 from jsonb_object_keys(r) k where k not in ('athleteCode','metric','value','unit','scope','eventId','playedOn','sourceRow','sourceColumn','derivedFrom')) then raise exception 'Unexpected game observation fields' using errcode='22023'; end if;
  foreach field in array array['athleteCode','metric','unit','scope'] loop
   if jsonb_typeof(r->field) is distinct from 'string' or length(r->>field)>80 or r->>field<>btrim(r->>field) then raise exception 'Invalid game observation identity' using errcode='22023'; end if;
  end loop;
  select c.source_column into metric_column from private.game_metric_columns c where c.source=p_source and c.metric=r->>'metric';
  if metric_column is null or jsonb_typeof(r->'sourceColumn') is distinct from 'number' or (r->>'sourceColumn')::numeric<>metric_column
    or jsonb_typeof(r->'sourceRow') is distinct from 'number' or (r->>'sourceRow')::numeric not between 2 and 2000 or trunc((r->>'sourceRow')::numeric)<>(r->>'sourceRow')::numeric
    or jsonb_typeof(r->'value') is distinct from 'number' then raise exception 'Invalid game metric or provenance' using errcode='22023'; end if;
  is_rate:=r->>'metric' in ('qpa_pct','strike_pct');
  if (r->>'value')::numeric<0 or (is_rate and ((r->>'value')::numeric>100 or r->>'unit'<>'%'))
    or (not is_rate and (r->>'unit'<>'count' or (r->>'value')::numeric>1000000000 or trunc((r->>'value')::numeric)<>(r->>'value')::numeric)) then raise exception 'Invalid game count or percentage' using errcode='22023'; end if;
  if p_source='qpa_fall_2026' then
   if r->>'scope'<>'cumulative_fall' or r->'eventId'<>'null'::jsonb or r->'playedOn'<>'null'::jsonb then raise exception 'QPA is a cumulative Fall snapshot, not a dated game' using errcode='22023'; end if;
  else
   if r->>'scope'<>'pitching_event' or jsonb_typeof(r->'eventId') is distinct from 'string' or r->>'eventId' !~ '^[A-Za-z0-9_-]{1,80}$' then raise exception 'Review the pitching period identity' using errcode='22023'; end if;
   if r->>'eventId' ~ '^fall-2026-week-[1-5]$' then
    if r->'playedOn' is distinct from 'null'::jsonb then raise exception 'Weekly totals cannot be labeled as a dated game' using errcode='22023'; end if;
   else
    if r->>'eventId' like 'fall-2026-week-%' or jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-[0-9]{2}-[0-9]{2}$' then raise exception 'Review the pitching event identity and date' using errcode='22023'; end if;
    if (r->>'playedOn')::date not between '2026-09-01'::date and '2026-12-31'::date or (r->>'playedOn')::date>(fetched at time zone 'America/Los_Angeles')::date then raise exception 'Pitching date is outside the observed Fall period' using errcode='22023'; end if;
   end if;
  end if;
  if r->>'metric'='earned_runs' and exists(select 1 from jsonb_array_elements(p_rows) x where x->>'athleteCode'=r->>'athleteCode' and x->'eventId'=r->'eventId' and x->>'metric'='r' and (r->>'value')::numeric>(x->>'value')::numeric) then raise exception 'Earned runs exceed total runs' using errcode='22023'; end if;
  if r->'derivedFrom'<>(case when is_rate then case when p_source='qpa_fall_2026' then '[3,2]'::jsonb else '[4,3]'::jsonb end when r->>'metric'='innings_outs' then '[18]'::jsonb else '[]'::jsonb end) then raise exception 'Invalid derived metric evidence' using errcode='22023'; end if;
  select id into a from public.athletes where athlete_code=private.canonical_athlete_code(r->>'athleteCode');
  if a is null or not exists(select 1 from public.athlete_seasons where athlete_id=a and season='2026-27') then raise exception 'Select an existing athlete in the reviewed current roster' using errcode='22023'; end if;
  if is_rate then
   select x into numerator from jsonb_array_elements(p_rows) x where x->>'athleteCode'=r->>'athleteCode' and x->'eventId'=r->'eventId' and x->>'metric'=case when p_source='qpa_fall_2026' then 'qpa' else 'strikes' end;
   select x into denominator from jsonb_array_elements(p_rows) x where x->>'athleteCode'=r->>'athleteCode' and x->'eventId'=r->'eventId' and x->>'metric'=case when p_source='qpa_fall_2026' then 'pa' else 'pitches' end;
   if numerator is null or denominator is null or numerator->'sourceRow'<>r->'sourceRow' or denominator->'sourceRow'<>r->'sourceRow'
     or (denominator->>'value')::numeric<=0 or (numerator->>'value')::numeric>(denominator->>'value')::numeric
     or (r->>'value')::float8<>100::float8*((numerator->>'value')::float8/(denominator->>'value')::float8) then raise exception 'Game rate does not match its entered counts' using errcode='22023'; end if;
  end if;
 end loop;
 select s.* into duplicate from public.game_stat_snapshots s where s.source=p_source and s.content_hash=p_hash;
 if duplicate.id is not null then
  if duplicate.observations<>p_rows then raise exception 'This source version was already mapped differently; review the conflict' using errcode='40001'; end if;
  return jsonb_build_object('snapshot_id',duplicate.id,'changed',false,'observations',jsonb_array_length(p_rows));
 end if;
 select s.* into previous from public.game_sync_state c join public.game_stat_snapshots s on s.id=c.snapshot_id where c.source=p_source;
 if previous.id is not null and fetched<=previous.fetched_at then raise exception 'A newer source snapshot is already saved' using errcode='40001'; end if;
 if exists(select 1 from public.game_stats old where old.source=p_source and not exists(
  select 1 from jsonb_array_elements(p_rows) x join public.athletes a on a.athlete_code=private.canonical_athlete_code(x->>'athleteCode')
  where a.id=old.athlete_id and x->>'metric'=old.metric and coalesce(x->>'eventId','')=old.event_id
 )) then raise exception 'Previously recorded source entries are missing. Review the source before replacing saved statistics' using errcode='40001'; end if;
 insert into public.game_stat_snapshots(source,content_hash,fetched_at,observations,created_by) values(p_source,p_hash,fetched,p_rows,auth.uid()) returning id into snapshot;
 delete from public.game_stats where source=p_source;
 for r in select value from jsonb_array_elements(p_rows) loop
  select id into a from public.athletes where athlete_code=private.canonical_athlete_code(r->>'athleteCode');
  insert into public.game_stats(source,athlete_id,metric,value,unit,scope,event_id,played_on,source_row,source_column,derived_from,snapshot_id,fetched_at,content_hash)
   values(p_source,a,r->>'metric',(r->>'value')::float8,r->>'unit',r->>'scope',coalesce(r->>'eventId',''),(r->>'playedOn')::date,(r->>'sourceRow')::integer,(r->>'sourceColumn')::integer,r->'derivedFrom',snapshot,fetched,p_hash);
 end loop;
 insert into public.game_sync_state(source,snapshot_id) values(p_source,snapshot) on conflict(source) do update set snapshot_id=excluded.snapshot_id;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'game_snapshot_imported',jsonb_build_object('source',p_source,'snapshot_id',snapshot,'content_hash',p_hash,'observations',jsonb_array_length(p_rows)));
 return jsonb_build_object('snapshot_id',snapshot,'changed',true,'observations',jsonb_array_length(p_rows));
end;
$$;

create or replace function private.game_rank_values() returns table(athlete_id uuid,source text,event_id text,played_on date,metric text,value float8,unit text,snapshot_id uuid,fetched_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with raw as (
 select g.* from public.game_stats g join public.game_sync_state c on c.source=g.source and c.snapshot_id=g.snapshot_id
 join public.athlete_seasons s on s.athlete_id=g.athlete_id and s.season='2026-27'
 where (s.roster_status is null or s.roster_status in ('active','redshirt'))
 ), q as (
 select athlete_id,source,snapshot_id,max(fetched_at) fetched_at,jsonb_object_agg(metric,value) v from raw where source='qpa_fall_2026' group by athlete_id,source,snapshot_id
 ), rates as (
 select q.*,r.metric,r.top,r.bottom,r.unit from q cross join lateral (values
 ('batting_avg',(v->>'base_hit')::float8,(v->>'ab')::float8,'avg'),
 ('batting_obp',(v->>'base_hit')::float8+(v->>'bb')::float8+(v->>'hbp')::float8,(v->>'ab')::float8+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8,'avg'),
 ('batting_hr_pct',(v->>'pumps')::float8,(v->>'pa')::float8,'%'),
 ('batting_bb_pct',(v->>'bb')::float8,(v->>'pa')::float8,'%'),
 ('batting_k_pct',(v->>'punchies')::float8,(v->>'pa')::float8,'%'),
 ('batting_hh_pct',(v->>'hh_base_hit')::float8+(v->>'three_eight_hh')::float8+(v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8,(v->>'ab')::float8-(v->>'punchies')::float8-(v->>'sac_bunt')::float8,'%')
 ) r(metric,top,bottom,unit)
 ), pitch as (
 select athlete_id,source,event_id,played_on,snapshot_id,max(fetched_at) fetched_at,jsonb_object_agg(metric,value) v from raw where source='pitching_fall_2026' group by athlete_id,source,event_id,played_on,snapshot_id
 ), pitch_rates as (
 select p.*,r.metric,r.top,(v->>'innings_outs')::float8 outs from pitch p cross join lateral (values
 ('pitching_k9',(v->>'k')::float8),('pitching_bb9',(v->>'bb_outcome')::float8),('pitching_era',(v->>'earned_runs')::float8)
 ) r(metric,top)
 ) select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from raw
 union all select athlete_id,source,'',null,metric,(case when unit='%' then 100::float8 else 1::float8 end)*(top/nullif(bottom,0)),unit,snapshot_id,fetched_at
 from rates where (metric<>'batting_hr_pct' or (v->>'base_hit') is null or top<=(v->>'base_hit')::float8) and (metric<>'batting_obp' or (v->>'pa') is null or bottom<=(v->>'pa')::float8) and bottom>0 and top>=0 and top<=bottom and (metric not in ('batting_avg','batting_obp') or (v->>'base_hit')::float8<=(v->>'ab')::float8)
 union all select athlete_id,source,event_id,played_on,metric,27::float8*top/nullif(outs,0),'per9',snapshot_id,fetched_at from pitch_rates where outs>0 and top>=0
$$;


create or replace function private.game_ranked() returns table(athlete_id uuid,source text,event_id text,played_on date,metric text,value float8,unit text,snapshot_id uuid,fetched_at timestamptz,place bigint,percentile float8,sample_size bigint)
language sql stable security invoker set search_path='' as $$
 with directed as (
 select r.*,case when (source='qpa_fall_2026' and metric in ('batting_k_pct','punchies','gdp')) or (source='pitching_fall_2026' and metric in ('pitching_bb9','pitching_era','bb_outcome','hbp','h','r')) then -value else value end score from private.game_rank_values() r
 ), ranked as (
 select d.*,rank() over(partition by source,event_id,metric,unit order by score desc) place,
 rank() over(partition by source,event_id,metric,unit order by score asc) low_rank,
 count(*) over(partition by source,event_id,metric,unit,score) ties,
 count(*) over(partition by source,event_id,metric,unit) n from directed d
 ) select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at,place,
 case when n>=5 then 100::float8*(low_rank-1+(ties-1)/2::float8)/(n-1) else null end,n from ranked
$$;
revoke all on function private.game_ranked() from public,anon,authenticated;

-- Add opportunity counts beside authorized game rankings. No general peer game-row access.
create or replace function private.game_leaderboards() returns jsonb language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
 if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then raise exception 'Active player or staff access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('metric',r.metric,'source',r.source,'eventId',r.event_id,'playedOn',r.played_on,'value',r.value,'unit',r.unit,'rank',r.place,'name',concat_ws(' ',coalesce(nullif(a.preferred_name,''),a.first_name),a.last_name),'code',a.athlete_code,'profileId',case when private.can_read_athlete(a.id) then a.id else null end,'updatedAt',r.fetched_at,'percentile',r.percentile,'sampleSize',r.sample_size,'opportunities',case when o.n>0 then o.n else null end) order by r.source,r.event_id,r.metric,r.place,a.athlete_code),'[]'::jsonb) into result
 from private.game_ranked() r join public.athletes a on a.id=r.athlete_id
 left join lateral (
 select case when r.source='qpa_fall_2026' then case
 when r.metric='batting_avg' then (v->>'ab')::numeric
 when r.metric='batting_obp' then (v->>'ab')::numeric+(v->>'bb')::numeric+(v->>'hbp')::numeric+(v->>'sac_fly')::numeric
 when r.metric='batting_hh_pct' then (v->>'ab')::numeric-(v->>'punchies')::numeric-(v->>'sac_bunt')::numeric
 else (v->>'pa')::numeric end
 when r.metric in ('pitching_k9','pitching_bb9','pitching_era') then (v->>'innings_outs')::numeric when r.metric='strike_pct' then (v->>'pitches')::numeric else null end n
 from (select jsonb_object_agg(g.metric,g.value) v from public.game_stats g
 where g.athlete_id=r.athlete_id and g.source=r.source and g.snapshot_id=r.snapshot_id and coalesce(g.event_id,'')=r.event_id) counts
 ) o on true
 where (r.source='qpa_fall_2026' and r.metric in ('batting_avg','batting_obp','batting_hr_pct','batting_bb_pct','batting_k_pct','batting_hh_pct','qpa_pct','pumps','sb','gdp'))
 or (r.source='pitching_fall_2026' and r.metric in ('pitching_k9','pitching_bb9','pitching_era','strike_pct','k','bb_outcome','pitches'));
 if jsonb_array_length(result)>10000 then raise exception 'Game leaderboard limit exceeded'; end if;
 return result;
end $$;

