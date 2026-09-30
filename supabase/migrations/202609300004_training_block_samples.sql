-- Own-player / authorized staff projection for count-weighted training blocks.
-- Read-only: no new grants to source tables, observations or sample-count writes.
create function public.athlete_training_block_samples(p_athlete_id uuid, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 20000 or p_offset % 1000 <> 0 then
    raise exception 'Invalid sample page' using errcode='22023';
  end if;
  return (
    with samples as (
      select m.observation_id, s.sample_count, m.value, m.measured_at, m.source, m.metric_key, m.unit
      from public.performance_measurements m
      join private.full_swing_session_samples s
        on s.athlete_id=m.athlete_id and s.file_hash=m.file_hash
        and s.source_row=m.source_row and s.metric_key=m.metric_key and s.unit=m.unit
      where m.athlete_id=p_athlete_id
        and m.source_sheet='CSV · Full Swing session summaries v1'
        and m.source in ('Full Swing · Game','Full Swing · Intrasquad','Full Swing · Practice')
        and m.metric_key in ('max_exit_velocity','avg_exit_velocity','max_bat_speed','avg_bat_speed','max_distance','max_pitch_velocity','avg_pitch_velocity')
        and m.unit in ('mph','ft')
        and m.measured_at between date '2026-09-01' and least(date '2026-12-31',(now() at time zone 'America/Los_Angeles')::date)
        -- One saved summary must own these count coordinates. A repeated file
        -- in a conflicting date/source never borrows the original count.
        and (select count(*) from public.performance_measurements candidate
          where candidate.athlete_id=m.athlete_id and candidate.file_hash=m.file_hash
            and candidate.metric_key=m.metric_key and candidate.unit=m.unit
            and candidate.source_row=m.source_row
            and candidate.source_sheet='CSV · Full Swing session summaries v1'
            and candidate.source in ('Full Swing · Game','Full Swing · Intrasquad','Full Swing · Practice'))=1
      order by m.observation_id limit 1000 offset p_offset
    )
    select coalesce(jsonb_agg(jsonb_build_object('observationId',observation_id,'count',sample_count,
      'value',value,'measuredAt',measured_at,'source',source,'metricKey',metric_key,'unit',unit) order by observation_id),'[]'::jsonb) from samples
  );
end;
$$;
revoke all on function public.athlete_training_block_samples(uuid,integer) from public,anon,authenticated;
grant execute on function public.athlete_training_block_samples(uuid,integer) to authenticated;
