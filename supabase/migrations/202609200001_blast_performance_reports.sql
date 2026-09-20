-- Blast weekly summaries, preserving signed angles and separate average/P95 provenance.
-- Deploy the compatible app first. Existing staff RPC, role checks and RLS are unchanged.
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('blast_swing_count','Blast Swing Count','neutral',false,false,true,false),
('p95_bat_speed','Peak Bat Speed (95th)','higher',false,true,false,false),
('blast_peak_hand_speed','Peak Hand Speed','neutral',false,false,false,false),
('blast_rotational_acceleration','Rotational Acceleration','neutral',false,false,false,false),
('blast_power','Swing Power','neutral',false,false,false,false),
('blast_on_plane_efficiency','On-Plane Efficiency','neutral',false,false,false,true),
('blast_attack_angle','Attack Angle','neutral',false,false,false,false),
('blast_vertical_bat_angle','Vertical Bat Angle','neutral',false,false,false,false),
('blast_time_to_contact','Time to Contact','neutral',false,false,true,false),
('blast_commit_time','Commit Time','neutral',false,false,true,false),
('blast_early_connection','Early Connection','neutral',false,false,false,false),
('blast_hinge_angle','Hinge Angle at Impact','neutral',false,false,false,false),
('blast_connection_impact','Connection at Impact','neutral',false,false,false,false),
('blast_body_tilt','Body Tilt Angle','neutral',false,false,false,false);
insert into private.performance_metric_units(metric_key,unit) values
('blast_swing_count','count'),
('p95_bat_speed','mph'),
('blast_peak_hand_speed','mph'),
('blast_rotational_acceleration','g'),
('blast_power','kw'),
('blast_on_plane_efficiency','%'),
('blast_attack_angle','deg'),
('blast_vertical_bat_angle','deg'),
('blast_time_to_contact','s'),
('blast_commit_time','s'),
('blast_early_connection','deg'),
('blast_hinge_angle','deg'),
('blast_connection_impact','deg'),
('blast_body_tilt','deg');
alter table public.performance_measurements drop constraint performance_measurements_value_check;
alter table public.performance_measurements add constraint performance_measurements_value_check check (value not in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) and (value>=0 or (metric_key in ('blast_attack_angle','blast_vertical_bat_angle','blast_early_connection','blast_hinge_angle','blast_connection_impact','blast_body_tilt') and unit='deg' and source ~ '^Blast Motion · (Average|P95) · 2026-[0-9]{2}-[0-9]{2}:2026-[0-9]{2}-[0-9]{2}$')));
create or replace function private.import_performance_original_codes(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r jsonb; key_name text; observation jsonb; athlete uuid; old public.performance_measurements;
  definition private.performance_metric_catalog; measured date; number_value float8;
  row_number integer; column_number integer; receipt uuid; created integer:=0; unchanged integer:=0;
  seen_positions text[]:='{}'; position_key text;
  fields text[]:=array['observation_id','athlete_code','metric_key','measured_at','value','unit','source','source_file','source_sheet','source_row','file_hash'];
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active administrator or coach required' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    raise exception 'Reviewed import requires 1–500 observations within 1 MiB' using errcode='22023';
  end if;
  if (select count(distinct x->>'observation_id') from jsonb_array_elements(p_rows) x) <> jsonb_array_length(p_rows) then
    raise exception 'Duplicate observation IDs in reviewed input' using errcode='22023';
  end if;
  insert into public.performance_imports(created_by) values(auth.uid()) returning id into receipt;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>cardinality(fields)
      or exists(select 1 from jsonb_object_keys(r) k where not k=any(fields)) then raise exception 'Unexpected measurement fields' using errcode='22023'; end if;
    foreach key_name in array fields loop
      if key_name in ('value','source_row') then
        if jsonb_typeof(r->key_name) is distinct from 'number' then raise exception 'Measurement value and source row must be numbers' using errcode='22023'; end if;
      elsif jsonb_typeof(r->key_name) is distinct from 'string' or length(r->>key_name)>2000 or (r->>key_name) ~ '[[:cntrl:]]'
        or (r->>key_name)<>btrim(r->>key_name) then raise exception 'Invalid measurement text field' using errcode='22023'; end if;
    end loop;
    if r->>'athlete_code' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' or r->>'file_hash' !~ '^[a-f0-9]{64}$'
      or length(r->>'source') not between 1 and 100 or length(r->>'source_file') not between 1 and 300 or length(r->>'source_sheet')>255
      or r->>'measured_at' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid measurement identity, date or provenance' using errcode='22023'; end if;
    begin
      measured:=(r->>'measured_at')::date;
      number_value:=(r->>'value')::float8;
      row_number:=(r->>'source_row')::integer;
      if (r->>'source_row')::numeric<>row_number then raise exception 'Non-integer source row'; end if;
      if left(r->>'observation_id',12)<>'observation:' then raise exception 'Invalid observation ID'; end if;
      observation:=substring(r->>'observation_id' from 13)::jsonb;
      if jsonb_typeof(observation) is distinct from 'array' or jsonb_array_length(observation)<>4
        or observation->>0 is distinct from r->>'file_hash' or observation->>1 is distinct from r->>'source_sheet'
        or jsonb_typeof(observation->2) is distinct from 'number' or jsonb_typeof(observation->3) is distinct from 'number'
        or (observation->>2)::numeric<>row_number then raise exception 'Observation provenance mismatch'; end if;
      column_number:=(observation->>3)::integer;
      if (observation->>3)::numeric<>column_number then raise exception 'Non-integer source column'; end if;
    exception when others then raise exception 'Invalid measurement number, date or source observation ID' using errcode='22023'; end;
    position_key:=jsonb_build_array(r->>'file_hash',r->>'source_sheet',row_number,column_number)::text;
    if position_key=any(seen_positions) then raise exception 'Duplicate source positions in reviewed input' using errcode='22023'; end if;
    seen_positions:=array_append(seen_positions,position_key);
    select * into definition from private.performance_metric_catalog where metric_key=r->>'metric_key';
    if definition.metric_key is null or not exists(select 1 from private.performance_metric_units where metric_key=definition.metric_key and unit=r->>'unit')
      or (number_value<0 and not (definition.metric_key in ('blast_attack_angle','blast_vertical_bat_angle','blast_early_connection','blast_hinge_angle','blast_connection_impact','blast_body_tilt') and r->>'unit'='deg')) or number_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
      or (definition.positive_only and number_value<=0) or (definition.percentage and number_value>100)
      or row_number not between 1 and 1000000 or column_number not between 0 and 10000
      or measured not between '2000-01-01'::date and '2099-12-31'::date then raise exception 'Unsupported metric, unit or value' using errcode='22023'; end if;
    if definition.metric_key like 'blast\_%' escape '\' or definition.metric_key='p95_bat_speed' or r->>'source' like 'Blast Motion · Average · %' or r->>'source' like 'Blast Motion · P95 · %' then
      if r->>'source' !~ '^Blast Motion · (Average|P95) · 2026-[0-9]{2}-[0-9]{2}:2026-[0-9]{2}-[0-9]{2}$'
        or r->>'source_sheet'<>'CSV'
        or definition.metric_key not in ('blast_swing_count','p95_bat_speed','blast_peak_hand_speed','blast_rotational_acceleration','blast_power','blast_on_plane_efficiency','blast_attack_angle','blast_vertical_bat_angle','blast_time_to_contact','blast_commit_time','blast_early_connection','blast_hinge_angle','blast_connection_impact','blast_body_tilt','avg_bat_speed')
        or (definition.metric_key='avg_bat_speed' and split_part(r->>'source',' · ',2)<>'Average')
        or (definition.metric_key='p95_bat_speed' and split_part(r->>'source',' · ',2)<>'P95')
        or split_part(split_part(r->>'source',' · ',3),':',1)::date<'2026-09-01'::date
        or split_part(split_part(r->>'source',' · ',3),':',1)::date>measured
        or split_part(split_part(r->>'source',' · ',3),':',2)::date<>measured
        or measured>'2026-12-31'::date
        or (definition.metric_key='blast_swing_count' and (number_value<>trunc(number_value) or number_value>9007199254740991))
        or column_number<>(case definition.metric_key when 'blast_swing_count' then 2 when 'p95_bat_speed' then 3 when 'blast_peak_hand_speed' then 4 when 'blast_rotational_acceleration' then 5 when 'blast_power' then 6 when 'blast_on_plane_efficiency' then 7 when 'blast_attack_angle' then 8 when 'blast_vertical_bat_angle' then 9 when 'blast_time_to_contact' then 10 when 'blast_commit_time' then 11 when 'blast_early_connection' then 12 when 'blast_hinge_angle' then 13 when 'blast_connection_impact' then 14 when 'blast_body_tilt' then 15 when 'avg_bat_speed' then 3 else -1 end) then
        raise exception 'Invalid Blast reporting period, summary type or source column' using errcode='22023';
      end if;
    end if;
    select id into athlete from public.athletes where athlete_code=r->>'athlete_code';
    if athlete is null then raise exception 'Select an existing permanent athlete code' using errcode='22023'; end if;
    if r->>'source' ~ '^Blast Motion · (Average|P95) · ' and exists (
      select 1 from public.performance_measurements m where m.athlete_id=athlete and m.metric_key=definition.metric_key
        and m.source=r->>'source' and m.measured_at=measured and m.file_hash<>r->>'file_hash'
    ) then raise exception 'A different Blast export already exists for this player and reporting period; review existing results first' using errcode='23505'; end if;
    select * into old from public.performance_measurements where observation_id=r->>'observation_id'
      or (file_hash=r->>'file_hash' and source_sheet=r->>'source_sheet' and source_row=row_number and source_column=column_number);
    if old.id is not null then
      if old.athlete_id<>athlete or old.metric_key<>definition.metric_key or old.unit<>r->>'unit' or old.measured_at<>measured or old.value<>number_value
        or old.source<>r->>'source' or old.file_hash<>r->>'file_hash' or old.source_sheet<>r->>'source_sheet' or old.source_row<>row_number or old.source_column<>column_number then
        raise exception 'Source observation already exists with different reviewed data; no values were replaced' using errcode='23505';
      end if;
      -- The original filename and import provenance survive renamed-file retries.
      unchanged:=unchanged+1;
    else
      insert into public.performance_measurements(observation_id,athlete_id,metric_key,metric,unit,measured_at,value,source,source_file,source_sheet,source_row,source_column,file_hash,import_id,imported_by)
      values(r->>'observation_id',athlete,definition.metric_key,definition.metric_label,r->>'unit',measured,number_value,r->>'source',r->>'source_file',r->>'source_sheet',row_number,column_number,r->>'file_hash',receipt,auth.uid());
      created:=created+1;
    end if;
  end loop;
  update public.performance_imports set created_count=created,unchanged_count=unchanged where id=receipt;
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'performance_imported',receipt,jsonb_build_object('created',created,'unchanged',unchanged));
  return jsonb_build_object('import_id',receipt,'created',created,'unchanged',unchanged);
end;
$$;

revoke all on function private.import_performance_original_codes(jsonb) from public,anon,authenticated;
