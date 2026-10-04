-- Compact Home coverage: metadata only. Invoker RLS and live trusted access
-- remain authoritative. No raw readings, names, emails or report identifiers.
create function public.home_measurement_summary(p_athlete_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  today date := (pg_catalog.now() at time zone 'America/Los_Angeles')::date;
  ids uuid[]; total integer; groups jsonb;
begin
  if p_athlete_id is null then
    if not (private.has_role('admin') or private.has_role('coach')) then
      raise exception 'Active staff required' using errcode='42501';
    end if;
    select coalesce(array_agg(s.athlete_id order by s.athlete_id),'{}'::uuid[]) into ids
      from public.athlete_seasons s where s.season='2026-27'
      and (s.roster_status is null or s.roster_status in ('active','redshirt'));
  else
    if not private.can_read_athlete(p_athlete_id) then
      raise exception 'Authorized player required' using errcode='42501';
    end if;
    if not exists(select 1 from public.athletes where id=p_athlete_id) then
      raise exception 'Player unavailable' using errcode='22023';
    end if;
    ids := array[p_athlete_id];
  end if;
  if cardinality(ids)>1000 then raise exception 'Home roster exceeds reviewed bounds' using errcode='22023'; end if;
  -- Check the existing history bound; never silently return partial coverage.
  select count(*) into total from (
    select 1 from public.performance_measurements m where m.athlete_id=any(ids)
      and m.measured_at between '2026-09-01'::date and least(today,'2026-12-31'::date)
      limit 20001
  ) bounded;
  if total>20000 then raise exception 'Home history exceeds reviewed bounds' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'athleteId',athlete_id,'metric',metric,'unit',unit,'source',source,
    'date',last_tested,'importedAt',last_imported,'count',n
  ) order by athlete_id,metric,unit,source),'[]'::jsonb) into groups from (
    select m.athlete_id,m.metric,m.unit,m.source,max(m.measured_at) last_tested,
      max(m.imported_at) last_imported,count(*)::integer n
    from public.performance_measurements m where m.athlete_id=any(ids)
      and m.measured_at between '2026-09-01'::date and least(today,'2026-12-31'::date)
    group by m.athlete_id,m.metric,m.unit,m.source
  ) compact;
  return jsonb_build_object('version',1,'athleteId',p_athlete_id,'today',today,
    'playerIds',to_jsonb(ids),'totalReadings',total,'groups',groups);
end;
$$;
revoke all on function public.home_measurement_summary(uuid) from public,anon,authenticated;
grant execute on function public.home_measurement_summary(uuid) to authenticated;
