-- Fall game dates begin September 1; the daily capture/sync schedule still starts September 12.
-- Preserve the existing grants, authorization, lock, validation and atomic replacement rules.
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
   if r->>'scope'<>'pitching_event' or jsonb_typeof(r->'eventId') is distinct from 'string' or r->>'eventId' !~ '^[A-Za-z0-9_-]{1,80}$'
    or jsonb_typeof(r->'playedOn') is distinct from 'string' or r->>'playedOn' !~ '^2026-[0-9]{2}-[0-9]{2}$' then raise exception 'Review the pitching event identity and date' using errcode='22023'; end if;
   if (r->>'playedOn')::date not between '2026-09-01'::date and '2026-12-31'::date or (r->>'playedOn')::date>(fetched at time zone 'America/Los_Angeles')::date then raise exception 'Pitching date is outside the observed Fall period' using errcode='22023'; end if;
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
