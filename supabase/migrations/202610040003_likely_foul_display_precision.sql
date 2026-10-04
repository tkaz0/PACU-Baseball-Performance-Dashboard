begin;
-- Preserve every non-EV float exactly, independent of session serialization settings.
create or replace view private.performance_display_measurements with(security_invoker=true) as
select m.id,m.observation_id,m.athlete_id,m.metric_key,m.metric,m.unit,m.measured_at,effective.value,m.source,m.source_file,m.source_sheet,m.source_row,m.source_column,m.file_hash,m.import_id,m.imported_by,m.imported_at from public.performance_measurements m
left join private.full_swing_foul_counts f on f.athlete_id=m.athlete_id and f.file_hash=m.file_hash
  and f.played_on=m.measured_at and m.source='Full Swing · '||case f.category
    when 'game' then 'Game' when 'practice' then 'Practice' else 'Intrasquad' end
  and m.source_sheet='CSV · Full Swing session summaries v1' and m.unit='mph'
  and m.metric_key in ('max_exit_velocity','avg_exit_velocity')
left join private.full_swing_session_samples s on s.athlete_id=m.athlete_id and s.file_hash=m.file_hash
  and s.metric_key=m.metric_key and s.unit=m.unit and s.source_row=m.source_row
cross join lateral (select case when coalesce(f.fouls,0)=0 then m.value
  when s.sample_count>f.fouls and s.sample_count>=f.contacts then
    case when m.metric_key='avg_exit_velocity' then (m.value*s.sample_count-f.foul_sum)/(s.sample_count-f.fouls)
      when m.value>=70 then m.value
      when s.sample_count=f.contacts then f.remaining_max end
  end as value) effective
where effective.value is not null and
  (coalesce(f.fouls,0)=0 or effective.value>0 and effective.value<=200);

-- The ordinary-history/staff view uses only an exact authorized scalar count.
create or replace view public.performance_display_measurements with(security_invoker=true) as
select m.id,m.observation_id,m.athlete_id,m.metric_key,m.metric,m.unit,m.measured_at,effective.value,m.source,m.source_file,m.source_sheet,m.source_row,m.source_column,m.file_hash,m.import_id,m.imported_by,m.imported_at from public.performance_measurements m
left join private.full_swing_foul_counts f on f.athlete_id=m.athlete_id and f.file_hash=m.file_hash
  and f.played_on=m.measured_at and m.source='Full Swing · '||case f.category
    when 'game' then 'Game' when 'practice' then 'Practice' else 'Intrasquad' end
  and m.source_sheet='CSV · Full Swing session summaries v1' and m.unit='mph'
  and m.metric_key in ('max_exit_velocity','avg_exit_velocity')
left join lateral (select private.full_swing_sample_count_for_display(m.athlete_id,m.file_hash,m.metric_key,m.unit,m.source_row) as sample_count) s on coalesce(f.fouls,0)>0
cross join lateral (select case when coalesce(f.fouls,0)=0 then m.value
  when s.sample_count>f.fouls and s.sample_count>=f.contacts then
    case when m.metric_key='avg_exit_velocity' then (m.value*s.sample_count-f.foul_sum)/(s.sample_count-f.fouls)
      when m.value>=70 then m.value
      when s.sample_count=f.contacts then f.remaining_max end
  end as value) effective
where effective.value is not null and
  (coalesce(f.fouls,0)=0 or effective.value>0 and effective.value<=200);

notify pgrst,'reload schema';
commit;
