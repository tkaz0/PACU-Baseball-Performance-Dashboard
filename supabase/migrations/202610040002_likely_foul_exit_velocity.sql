begin;
-- Read-only display projections. Original CSV summaries/contacts/sample evidence
-- and publication revisions remain immutable; pitcher and bat-speed data do not change.
-- Original sample evidence remains inaccessible directly, including to players.
create function private.full_swing_sample_count_for_display(p_athlete uuid,p_hash text,p_metric text,p_unit text,p_row integer)
returns integer language plpgsql stable security definer set search_path='' as $$
begin
  if not private.can_read_athlete(p_athlete) then
    raise exception 'Athlete access denied' using errcode='42501';
  end if;
  return (select sample_count from private.full_swing_session_samples where athlete_id=p_athlete
    and file_hash=p_hash and metric_key=p_metric and unit=p_unit and source_row=p_row);
end;
$$;
revoke all on function private.full_swing_sample_count_for_display(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function private.full_swing_sample_count_for_display(uuid,text,text,text,integer) to authenticated;

create view private.full_swing_foul_counts with(security_invoker=true) as
select athlete_id,file_hash,played_on,category,count(*)::integer as contacts,
  count(*) filter(where exit_velocity<70 and abs(direction)>45)::integer as fouls,
  coalesce(sum(exit_velocity) filter(where exit_velocity<70 and abs(direction)>45),0) as foul_sum,
  max(exit_velocity) filter(where not coalesce(exit_velocity<70 and abs(direction)>45,false)) as remaining_max
from public.full_swing_contacts group by athlete_id,file_hash,played_on,category;

create view private.full_swing_display_samples with(security_invoker=true) as
select s.file_hash,s.athlete_id,s.metric_key,s.unit,s.source_row,
  (s.sample_count-case when s.metric_key in ('max_exit_velocity','avg_exit_velocity') and s.unit='mph'
    then coalesce(f.fouls,0) else 0 end)::integer as sample_count,s.created_at
from private.full_swing_session_samples s
left join public.performance_measurements m on m.athlete_id=s.athlete_id and m.file_hash=s.file_hash
  and m.metric_key=s.metric_key and m.unit=s.unit and m.source_row=s.source_row
  and m.source_sheet='CSV · Full Swing session summaries v1'
left join private.full_swing_foul_counts f on f.athlete_id=m.athlete_id and f.file_hash=m.file_hash
  and f.played_on=m.measured_at and m.source='Full Swing · '||case f.category
    when 'game' then 'Game' when 'practice' then 'Practice' else 'Intrasquad' end
where coalesce(f.fouls,0)=0 or s.metric_key not in ('max_exit_velocity','avg_exit_velocity')
  or (f.contacts<=s.sample_count and f.fouls<s.sample_count);

create view private.performance_display_measurements with(security_invoker=true) as
select projected.* from public.performance_measurements m
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
cross join lateral jsonb_populate_record(null::public.performance_measurements,
  to_jsonb(m)||jsonb_build_object('value',effective.value)) projected
where effective.value is not null and
  (coalesce(f.fouls,0)=0 or effective.value>0 and effective.value<=200);

-- The ordinary-history/staff view uses only an exact authorized scalar count.
create view public.performance_display_measurements with(security_invoker=true) as
select projected.* from public.performance_measurements m
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
cross join lateral jsonb_populate_record(null::public.performance_measurements,
  to_jsonb(m)||jsonb_build_object('value',effective.value)) projected
where effective.value is not null and
  (coalesce(f.fouls,0)=0 or effective.value>0 and effective.value<=200);

revoke all on private.full_swing_foul_counts,private.full_swing_display_samples,
  private.performance_display_measurements,public.performance_display_measurements from public,anon,authenticated;
grant select on private.full_swing_foul_counts,public.performance_display_measurements to authenticated;

-- Reuse the reviewed reader contracts, guards, scopes, ordering and limits.
-- Fixed allowlist: never rewrite an import, correction, archive or raw-review reader.
do $$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.athlete_performance_measurements(uuid,integer)',
    'private.performance_summary(uuid)',
    'private.leaderboard_latest()',
    'private.team_leaderboard(text,text,text,text)',
    'private.hitting_team_averages()',
    'public.athlete_training_block_samples(uuid,integer)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if position('public.performance_measurements' in definition)=0 then
      raise exception 'Reviewed display reader shape changed: %',signature;
    end if;
    if signature='public.athlete_training_block_samples(uuid,integer)' then
      -- Keep its raw-coordinate uniqueness guard; project only the display row.
      definition:=replace(definition,'from public.performance_measurements m','from private.performance_display_measurements m');
    else
      definition:=replace(definition,'public.performance_measurements',case when signature='public.athlete_performance_measurements(uuid,integer)' then 'public.performance_display_measurements' else 'private.performance_display_measurements' end);
    end if;
    definition:=replace(definition,'private.full_swing_session_samples','private.full_swing_display_samples');
    execute definition;
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
