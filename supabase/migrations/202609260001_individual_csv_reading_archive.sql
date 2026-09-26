-- An Admin can archive one reviewed Full Swing maximum without removing its file's other readings.
-- The existing CSV archive stores the original row for an exact, guarded restore.
create function private.csv_max_readings(p_athlete uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'metricKey',m.metric_key,'value',m.value,'unit',m.unit,
    'source',m.source,'sourceFile',m.source_file,'measuredAt',m.measured_at,
    'fingerprint',md5(jsonb_build_array(to_jsonb(m))::text)
  ) order by m.metric_key,m.source,m.measured_at desc,m.value desc),'[]'::jsonb) into rows
  from public.performance_measurements m
  where m.athlete_id=p_athlete and m.source ~* '^Full Swing( · |$)'
    and m.metric_key in ('classified_max_spin','max_distance');
  if jsonb_array_length(rows)>200 then raise exception 'Too many readings to review' using errcode='22023'; end if;
  return rows;
end $$;

create function private.archive_csv_max_reading(p_request_id uuid,p_athlete uuid,p_observation uuid,p_fingerprint text,p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.csv_measurement_archives; old public.performance_measurements; saved jsonb; changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true or p_request_id is null or p_athlete is null or p_observation is null
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{32}$' then
    raise exception 'Review the exact CSV reading' using errcode='22023';
  end if;
  select * into prior from private.csv_measurement_archives where request_id=p_request_id for update;
  if prior.request_id is not null then
    if prior.athlete_id<>p_athlete or prior.fingerprint<>p_fingerprint
      or jsonb_array_length(prior.observations)<>1 or (prior.observations->0->>'id')::uuid<>p_observation then
      raise exception 'Removal request already used' using errcode='23505';
    end if;
    return jsonb_build_object('requestId',p_request_id,'count',1,'removed',prior.restored_at is null);
  end if;
  select * into old from public.performance_measurements m where m.id=p_observation and m.athlete_id=p_athlete for update;
  if old.id is null or old.metric_key not in ('classified_max_spin','max_distance')
    or old.source !~* '^Full Swing( · |$)' then
    raise exception 'This CSV maximum is no longer available' using errcode='40001';
  end if;
  saved:=jsonb_build_array(to_jsonb(old));
  if md5(saved::text)<>p_fingerprint then raise exception 'CSV reading changed; refresh and review again' using errcode='40001'; end if;
  insert into private.csv_measurement_archives(request_id,athlete_id,file_hash,fingerprint,source_file,observations,actor_id)
    values(p_request_id,p_athlete,old.file_hash,p_fingerprint,old.source_file,saved,auth.uid());
  delete from public.performance_measurements where id=old.id;
  get diagnostics changed = row_count;
  if changed<>1 then raise exception 'CSV reading changed' using errcode='40001'; end if;
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(auth.uid(),'csv_max_reading_removed',p_request_id,jsonb_build_object('observationId',p_observation,'metricKey',old.metric_key));
  return jsonb_build_object('requestId',p_request_id,'count',1,'removed',true);
end $$;

create function public.admin_csv_max_readings(p_athlete uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.csv_max_readings(p_athlete)$$;
create function public.admin_archive_csv_max_reading(p_request_id uuid,p_athlete uuid,p_observation uuid,p_fingerprint text,p_reviewed boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select private.archive_csv_max_reading(p_request_id,p_athlete,p_observation,p_fingerprint,p_reviewed)
$$;
revoke all on function private.csv_max_readings(uuid),private.archive_csv_max_reading(uuid,uuid,uuid,text,boolean),
  public.admin_csv_max_readings(uuid),public.admin_archive_csv_max_reading(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.csv_max_readings(uuid),private.archive_csv_max_reading(uuid,uuid,uuid,text,boolean),
  public.admin_csv_max_readings(uuid),public.admin_archive_csv_max_reading(uuid,uuid,uuid,text,boolean) to authenticated;
