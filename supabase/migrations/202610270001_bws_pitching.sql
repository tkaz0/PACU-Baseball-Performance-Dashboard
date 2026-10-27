-- Owner-reviewed October 27: distinct BWS tournament aggregate following Fall Ball.
-- Preserve immutable snapshots, every prior entry, staff checks, locks and own-player RLS.
begin;
insert into private.game_metric_columns(source,metric,source_column)
values ('pitching_fall_2026','swing_miss',24);

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
  if p_source='pitching_fall_2026' then
   if r->>'eventId'='fall-2026-bws' then
    if r->>'metric'='weak_contact' then metric_column:=26; end if;
    if r->>'metric'='earned_runs' then raise exception 'BWS column Z records weak contact, not earned runs' using errcode='22023'; end if;
   elsif r->>'metric'='swing_miss' then raise exception 'Swings and misses require the reviewed BWS block' using errcode='22023'; end if;
  end if;
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
   if r->>'eventId' ~ '^fall-2026-week-[1-5]$' or r->>'eventId'='fall-2026-bws' then
    if r->'playedOn' is distinct from 'null'::jsonb then raise exception 'Aggregate totals cannot be labeled as a dated game' using errcode='22023'; end if;
    if r->>'eventId'='fall-2026-bws' and fetched<'2026-10-23T00:00:00-07:00'::timestamptz then raise exception 'BWS capture predates the reviewed tournament' using errcode='22023'; end if;
   else
    if r->>'eventId' like 'fall-2026-bws%' or r->>'eventId'='fall-2026-cumulative' or r->>'eventId' like 'fall-2026-week-%' or jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-[0-9]{2}-[0-9]{2}$' then raise exception 'Review the pitching event identity and date' using errcode='22023'; end if;
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
 with entries as (
 select g.* from public.game_stats g join public.game_sync_state c on c.source=g.source and c.snapshot_id=g.snapshot_id
 join public.athlete_seasons s on s.athlete_id=g.athlete_id and s.season='2026-27'
 where (s.roster_status is null or s.roster_status in ('active','redshirt'))
 ), pitch_periods as (
 select athlete_id,source,snapshot_id,count(distinct event_id) periods,
 bool_or(event_id ~ '^fall-2026-week-[1-5]$' or event_id='fall-2026-bws') weekly,
 bool_or(event_id !~ '^fall-2026-week-[1-5]$' and event_id<>'fall-2026-bws') dated from entries where source='pitching_fall_2026' group by athlete_id,source,snapshot_id
 ), complete_counts as (
 select e.athlete_id,e.source,'fall-2026-cumulative'::text event_id,null::date played_on,e.metric,sum(e.value)::float8 value,'count'::text unit,e.snapshot_id,max(e.fetched_at) fetched_at
 from entries e join pitch_periods p using(athlete_id,source,snapshot_id)
 where e.unit='count' and not(p.weekly and p.dated)
 group by e.athlete_id,e.source,e.snapshot_id,e.metric,p.periods having count(*)=p.periods
 ), raw as (
 select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from entries where source='qpa_fall_2026'
 union all select * from complete_counts
 union all select s.athlete_id,s.source,s.event_id,s.played_on,'strike_pct',100::float8*s.value/nullif(p.value,0),'%',s.snapshot_id,greatest(s.fetched_at,p.fetched_at)
 from complete_counts s join complete_counts p using(athlete_id,source,event_id,snapshot_id) where s.metric='strikes' and p.metric='pitches' and p.value>0 and s.value<=p.value
 ), q as (
 select athlete_id,source,snapshot_id,max(fetched_at) fetched_at,private.qpa_batting_counts(jsonb_object_agg(metric,value)) v from raw where source='qpa_fall_2026' group by athlete_id,source,snapshot_id
 ), rates as (
 select q.*,r.metric,r.top,r.bottom,r.unit from q cross join lateral (values
 ('batting_avg',(v->>'base_hit')::float8,(v->>'ab')::float8,'avg'),
 ('batting_obp',(v->>'base_hit')::float8+(v->>'bb')::float8+(v->>'hbp')::float8,(v->>'ab')::float8+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8,'avg'),
 ('batting_hr_pct',(v->>'pumps')::float8,(v->>'pa')::float8,'%'),
 ('batting_bb_pct',(v->>'bb')::float8,(v->>'pa')::float8,'%'),
 ('batting_k_pct',(v->>'punchies')::float8,(v->>'pa')::float8,'%'),
 ('batting_8plus_pct',(v->>'eight_plus_pitches')::float8,(v->>'pa')::float8,'%'),
 ('batting_hh_pct',(v->>'hh_base_hit')::float8+(v->>'three_eight_hh')::float8+(v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8,coalesce(v->>'_qpa_sheet_ab',v->>'ab')::float8-(v->>'punchies')::float8-(v->>'sac_bunt')::float8,'%')
 ) r(metric,top,bottom,unit)
 ), pitch as (
 select athlete_id,source,event_id,played_on,snapshot_id,max(fetched_at) fetched_at,jsonb_object_agg(metric,value) v from raw where source='pitching_fall_2026' group by athlete_id,source,event_id,played_on,snapshot_id
 ), pitch_rates as (
 select p.*,r.metric,r.top,(v->>'innings_outs')::float8 outs from pitch p cross join lateral (values
 ('pitching_k9',(v->>'k')::float8),('pitching_bb9',(v->>'bb_outcome')::float8),('pitching_r9',(v->>'r')::float8)
 ) r(metric,top)
 ), contact_rates as (
 select p.*,r.metric,r.top,(v->>'weak_contact')::float8+(v->>'hard_contact')::float8 contacts from pitch p cross join lateral (values
 ('weak_contact_pct',(v->>'weak_contact')::float8),('hard_contact_pct',(v->>'hard_contact')::float8)
 ) r(metric,top)
 ), power_parts as (
 select q.*, (v->>'base_hit')::float8 hits,(v->>'hh_extra_base_hit')::float8 xbh,(v->>'pumps')::float8 hr,(v->>'ab')::float8 ab,
 (v->>'base_hit')::float8+(v->>'hh_extra_base_hit')::float8+3::float8*(v->>'pumps')::float8 bases,
 .882::float8*((v->>'base_hit')::float8-(v->>'hh_extra_base_hit')::float8-(v->>'pumps')::float8)+1.252::float8*(v->>'hh_extra_base_hit')::float8+2.037::float8*(v->>'pumps')::float8 weighted_hits
 from q where (v->>'ab')::float8>0 and (v->>'base_hit')::float8<=(v->>'ab')::float8
 and (v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8<=(v->>'base_hit')::float8
 ), production as (
 select p.*,bases+(v->>'bb')::float8+(v->>'hbp')::float8 top,(v->>'pa')::float8 bottom
 from power_parts p where (v->>'pa')::float8>0
 and ab+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8<=(v->>'pa')::float8
 ), production_baseline as (
 select source,snapshot_id,sum(top)/nullif(sum(bottom),0) baseline from production group by source,snapshot_id having count(*)>=5
 ) select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from raw
 union all select athlete_id,source,'',null,metric,(case when unit='%' then 100::float8 else 1::float8 end)*(top/nullif(bottom,0)),unit,snapshot_id,fetched_at
 from rates where (metric<>'batting_hr_pct' or (v->>'base_hit') is null or top<=(v->>'base_hit')::float8) and (metric<>'batting_obp' or (v->>'pa') is null or bottom<=(v->>'pa')::float8) and bottom>0 and top>=0 and top<=bottom and (metric not in ('batting_avg','batting_obp') or (v->>'base_hit')::float8<=(v->>'ab')::float8)
 union all select p.athlete_id,p.source,'',null,'batting_ops',r.top/r.bottom+p.bases/p.ab,'avg',p.snapshot_id,p.fetched_at
 from power_parts p join rates r on r.athlete_id=p.athlete_id and r.source=p.source and r.snapshot_id=p.snapshot_id
 where r.metric='batting_obp' and r.bottom>0 and r.top>=0 and r.top<=r.bottom
 and ((r.v->>'pa') is null or r.bottom<=(r.v->>'pa')::float8)
 union all select athlete_id,source,event_id,played_on,metric,27::float8*top/nullif(outs,0),'per9',snapshot_id,fetched_at from pitch_rates where outs>0 and top>=0
 union all select athlete_id,source,event_id,played_on,metric,100::float8*top/nullif(contacts,0),'%',snapshot_id,fetched_at from contact_rates where top>=0 and contacts>0 and top<=contacts
 union all select athlete_id,source,'',null,r.metric,r.value,'avg',snapshot_id,fetched_at from power_parts p
 cross join lateral (values ('batting_est_slg',bases/ab),('batting_est_iso',(xbh+3::float8*hr)/ab)) r(metric,value)
 union all select athlete_id,source,'',null,'batting_est_wobacon',weighted_hits/nullif(ab-(v->>'punchies')::float8+(v->>'sac_fly')::float8,0),'avg',snapshot_id,fetched_at from power_parts
 where (v->>'punchies')::float8+hits<=ab and ab-(v->>'punchies')::float8+(v->>'sac_fly')::float8>0
 union all select p.athlete_id,p.source,'',null,'batting_production_plus',100::float8*(p.top/p.bottom)/b.baseline,'index',p.snapshot_id,p.fetched_at from production p join production_baseline b using(source,snapshot_id) where b.baseline>0
 union all select athlete_id,source,event_id,played_on,'pitching_whip',3::float8*((v->>'h')::float8+(v->>'bb_outcome')::float8)/nullif((v->>'innings_outs')::float8,0),'decimal',snapshot_id,fetched_at from pitch where (v->>'innings_outs')::float8>0 and (v->>'h') is not null and (v->>'bb_outcome') is not null
 union all select athlete_id,source,event_id,played_on,'pitching_k_bb',(v->>'k')::float8/nullif((v->>'bb_outcome')::float8,0),'decimal',snapshot_id,fetched_at from pitch where (v->>'bb_outcome')::float8>0 and (v->>'k') is not null
$$;

-- CREATE OR REPLACE retains the importer's existing authenticated wrapper privileges.
revoke all on function private.import_game_snapshot(text,text,text,jsonb) from public,anon;
revoke all on function private.game_rank_values() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
