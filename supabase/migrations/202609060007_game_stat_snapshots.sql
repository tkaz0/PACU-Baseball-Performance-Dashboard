-- Reviewed Fall source snapshots, separate from physical/testing measurements.
create table private.game_metric_columns(source text not null,metric text not null,source_column integer not null,primary key(source,metric));
insert into private.game_metric_columns values
('qpa_fall_2026','pa',2),('qpa_fall_2026','qpa',3),('qpa_fall_2026','ab',5),('qpa_fall_2026','hh_base_hit',9),('qpa_fall_2026','hh_extra_base_hit',10),('qpa_fall_2026','pumps',11),('qpa_fall_2026','base_hit',12),('qpa_fall_2026','three_eight_hh',13),('qpa_fall_2026','eight_plus_pitches',14),('qpa_fall_2026','bb',15),('qpa_fall_2026','rbi',16),('qpa_fall_2026','sac_bunt',17),('qpa_fall_2026','moving_runner',18),('qpa_fall_2026','hbp',19),('qpa_fall_2026','punchies',20),('qpa_fall_2026','ab_control',23),('qpa_fall_2026','qpa_pct',8),
('pitching_fall_2026','pitches',3),('pitching_fall_2026','strikes',4),('pitching_fall_2026','fb',6),('pitching_fall_2026','fb_k',7),('pitching_fall_2026','bb_pitch_family',9),('pitching_fall_2026','bb_pitch_family_k',10),('pitching_fall_2026','ch',12),('pitching_fall_2026','ch_k',13),('pitching_fall_2026','baf',15),('pitching_fall_2026','fps',16),('pitching_fall_2026','h',19),('pitching_fall_2026','r',20),('pitching_fall_2026','bb_outcome',21),('pitching_fall_2026','hbp',22),('pitching_fall_2026','k',23),('pitching_fall_2026','strike_pct',5);
revoke all on private.game_metric_columns from public,anon,authenticated;
create table public.game_stat_snapshots(
 id uuid primary key default gen_random_uuid(),source text not null check(source in ('qpa_fall_2026','pitching_fall_2026')),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),fetched_at timestamptz not null,
 observations jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(source,content_hash)
);
create table public.game_sync_state(source text primary key check(source in ('qpa_fall_2026','pitching_fall_2026')),snapshot_id uuid not null references public.game_stat_snapshots(id));
create table public.game_stats(
 source text not null,athlete_id uuid not null references public.athletes(id),metric text not null,
 value float8 not null check(value>=0 and value not in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)),unit text not null check(unit in ('count','%')),
 scope text not null check(scope in ('cumulative_fall','pitching_event')),event_id text not null,played_on date,
 source_row integer not null check(source_row between 2 and 2000),source_column integer not null,derived_from jsonb not null,
 snapshot_id uuid not null references public.game_stat_snapshots(id),fetched_at timestamptz not null,content_hash text not null,primary key(source,athlete_id,event_id,metric),
 foreign key(source,metric) references private.game_metric_columns(source,metric)
);
alter table public.game_stat_snapshots enable row level security;
alter table public.game_sync_state enable row level security;
alter table public.game_stats enable row level security;
revoke all on public.game_stat_snapshots,public.game_sync_state,public.game_stats from public,anon,authenticated;
grant select on public.game_stat_snapshots,public.game_sync_state,public.game_stats to authenticated;
create policy game_snapshots_staff on public.game_stat_snapshots for select to authenticated using(private.has_role('admin') or private.has_role('coach'));
create policy game_sync_staff on public.game_sync_state for select to authenticated using(private.has_role('admin') or private.has_role('coach'));
create policy game_stats_athlete on public.game_stats for select to authenticated using(private.can_read_athlete(athlete_id));
create function private.game_sync_now() returns timestamptz language sql stable set search_path='' as $$select statement_timestamp();$$;
revoke all on function private.game_sync_now() from public,anon,authenticated;

create function private.import_game_snapshot(p_source text,p_hash text,p_fetched_at text,p_rows jsonb) returns jsonb
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
   if r->>'scope'<>'pitching_event' or jsonb_typeof(r->'eventId') is distinct from 'string' or r->>'eventId' !~ '^[A-Za-z0-9_-]{1,80}$'
    or jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-[0-9]{2}-[0-9]{2}$' then raise exception 'Review the pitching event identity and date' using errcode='22023'; end if;
   if (r->>'playedOn')::date not between '2026-09-12'::date and '2026-12-31'::date or (r->>'playedOn')::date>(fetched at time zone 'America/Los_Angeles')::date then raise exception 'Pitching date is outside the observed Fall period' using errcode='22023'; end if;
  end if;
  if r->'derivedFrom'<>(case when is_rate then case when p_source='qpa_fall_2026' then '[3,2]'::jsonb else '[4,3]'::jsonb end else '[]'::jsonb end) then raise exception 'Invalid derived metric evidence' using errcode='22023'; end if;
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
create function public.import_game_snapshot(p_source text,p_hash text,p_fetched_at text,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.import_game_snapshot(p_source,p_hash,p_fetched_at,p_rows);$$;
create function public.read_game_stats(p_athlete_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
 if p_athlete_id is null then
  if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Select your linked athlete' using errcode='42501'; end if;
 elsif not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
  select source,athlete_id,metric,value,unit,scope,nullif(event_id,'') event_id,played_on,source_row,source_column,derived_from,snapshot_id,fetched_at,content_hash
  from public.game_stats where p_athlete_id is null or athlete_id=p_athlete_id order by athlete_id,source,event_id,metric limit 10001
 )x;
 return result;
end;
$$;
revoke all on function private.import_game_snapshot(text,text,text,jsonb),public.import_game_snapshot(text,text,text,jsonb),public.read_game_stats(uuid) from public,anon,authenticated;
grant execute on function private.import_game_snapshot(text,text,text,jsonb),public.import_game_snapshot(text,text,text,jsonb),public.read_game_stats(uuid) to authenticated;
