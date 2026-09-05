-- Serialize raw float8 observations with the same round-trip precision as the
-- comparison summary. Keep ordinary caller permissions and table RLS in force.
create function public.athlete_performance_measurements(p_athlete_id uuid, p_offset integer default 0)
returns jsonb language plpgsql stable security invoker
set search_path = '' set extra_float_digits = 3 as $$
declare result jsonb;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 20000 or p_offset % 1000 <> 0 then
    raise exception 'Invalid measurement page offset' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'observation_id', m.observation_id,
    'athlete_id', m.athlete_id,
    'metric_key', m.metric_key,
    'metric', m.metric,
    'unit', m.unit,
    'value', m.value,
    'measured_at', m.measured_at,
    'source', m.source,
    'source_file', m.source_file,
    'source_sheet', m.source_sheet,
    'source_row', m.source_row,
    'file_hash', m.file_hash,
    'import_id', m.import_id,
    'imported_at', m.imported_at
  ) order by m.imported_at, m.id), '[]'::jsonb) into result
  from (
    select id, observation_id, athlete_id, metric_key, metric, unit, value,
      measured_at, source, source_file, source_sheet, source_row, file_hash,
      import_id, imported_at
    from public.performance_measurements
    where athlete_id = p_athlete_id
    order by imported_at, id
    limit 1000 offset p_offset
  ) m;
  return result;
end;
$$;

revoke all on function public.athlete_performance_measurements(uuid, integer) from public, anon, authenticated;
grant execute on function public.athlete_performance_measurements(uuid, integer) to authenticated;
