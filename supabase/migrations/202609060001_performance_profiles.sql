-- Reviewed numerical observations only. No report images, OCR text or Auth provisioning.
create table private.performance_metric_catalog (
  metric_key text primary key,
  metric_label text not null,
  direction text not null check (direction in ('neutral','higher','lower')),
  body_metric boolean not null,
  profile_metric boolean not null,
  positive_only boolean not null default false,
  percentage boolean not null default false
);
create table private.performance_metric_units (
  metric_key text not null references private.performance_metric_catalog(metric_key),
  unit text not null,
  primary key(metric_key,unit)
);
insert into private.performance_metric_catalog(metric_key,metric_label,direction,body_metric,profile_metric,positive_only,percentage) values
('height','Height','neutral',true,true,true,false),
('weight','Weight','neutral',true,true,true,false),
('body_fat_pct','Body Fat Percentage','neutral',true,true,false,true),
('muscle_mass_pct','Muscle Mass Percentage','neutral',true,true,false,true),
('max_exit_velocity','Max Exit Velocity','higher',false,true,false,false),
('avg_exit_velocity','Average Exit Velocity','higher',false,true,false,false),
('bat_speed','Bat Speed','higher',false,true,false,false),
('home_to_first','Home to First','lower',false,true,true,false),
('home_to_second','Home to Second','lower',false,true,true,false),
('steal_break','Steal Break','lower',false,true,true,false),
('boxer_t','Boxer T','lower',false,true,true,false),
('max_pitch_velocity','Max Pitch Velocity','higher',false,true,false,false),
('avg_fastball_spin','Average Fastball Spin','neutral',false,true,false,false),
('strike_pct','Strike Percentage','higher',false,true,false,true),
('k_pct','Strikeout Percentage','higher',false,true,false,true),
('bb_pct','Walk Percentage','lower',false,true,false,true),
('body_fat_mass','Body Fat Mass','neutral',true,false,false,false),
('bone_mass','Bone Mass','neutral',true,false,false,false),
('protein_mass','Protein Mass','neutral',true,false,false,false),
('body_water_mass','Body Water Mass','neutral',true,false,false,false),
('muscle_mass','Muscle Mass','neutral',true,false,false,false),
('skeletal_muscle_mass','Skeletal Muscle Mass','neutral',true,false,false,false),
('bmi','BMI','neutral',true,false,false,false),
('bmr','BMR','neutral',true,false,false,false),
('fat_free_mass','Fat-Free Mass','neutral',true,false,false,false),
('subcutaneous_fat_pct','Subcutaneous Fat','neutral',true,false,false,true),
('skeletal_muscle_pct','Skeletal Muscle Percentage','neutral',true,false,false,true),
('body_water_pct','Body Water Percentage','neutral',true,false,false,true),
('protein_pct','Protein Percentage','neutral',true,false,false,true),
('metabolic_age','Metabolic Age','neutral',true,false,false,false),
('visceral_fat','Visceral Fat','neutral',true,false,false,false),
('smi','Skeletal Muscle Index','neutral',true,false,false,false),
('whr','Waist-to-Hip Ratio','neutral',true,false,false,false),
('bone_mass_pct','Bone Mass Percentage','neutral',true,false,false,true);
insert into private.performance_metric_units(metric_key,unit)
select metric_key,unnest(case
  when metric_key='height' then array['in','cm']
  when metric_key='weight' then array['lb','kg','st']
  when metric_key in ('body_fat_mass','bone_mass','protein_mass','body_water_mass','muscle_mass','skeletal_muscle_mass','fat_free_mass') then array['lb','kg']
  when percentage then array['%']
  when metric_key in ('max_exit_velocity','avg_exit_velocity','bat_speed','max_pitch_velocity') then array['mph','km/h','m/s']
  when metric_key in ('home_to_first','home_to_second','steal_break','boxer_t') then array['s']
  when metric_key='avg_fastball_spin' then array['rpm']
  when metric_key in ('bmi','smi') then array['kg/m²']
  when metric_key='bmr' then array['kcal','kcal/day']
  when metric_key='visceral_fat' then array['index','grade']
  when metric_key='metabolic_age' then array['years']
  when metric_key='whr' then array['ratio']
end) from private.performance_metric_catalog;
revoke all on private.performance_metric_catalog,private.performance_metric_units from public,anon,authenticated;

create table public.performance_imports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_count integer not null default 0 check(created_count between 0 and 500),
  unchanged_count integer not null default 0 check(unchanged_count between 0 and 500)
);
create table public.performance_measurements (
  id uuid primary key default gen_random_uuid(),
  observation_id text not null unique check(length(observation_id) between 1 and 2000),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  metric_key text not null,
  metric text not null,
  unit text not null,
  measured_at date not null check(measured_at between '1900-01-01'::date and '2100-12-31'::date),
  value double precision not null check(value>=0 and value not in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)),
  source text not null check(length(source) between 1 and 100),
  source_file text not null check(length(source_file) between 1 and 300),
  source_sheet text not null check(length(source_sheet)<=255),
  source_row integer not null check(source_row between 1 and 1000000),
  source_column integer not null check(source_column between 0 and 10000),
  file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
  import_id uuid not null references public.performance_imports(id) on delete restrict,
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  foreign key(metric_key,unit) references private.performance_metric_units(metric_key,unit),
  unique(file_hash,source_sheet,source_row,source_column)
);
-- A report has one unambiguous result for a metric/unit; trial-table rows may repeat.
create unique index performance_report_metric_unique on public.performance_measurements(athlete_id,file_hash,measured_at,metric_key,unit)
where source='RENPHO' and source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$';
create index performance_athlete_history on public.performance_measurements(athlete_id,measured_at desc,imported_at desc,id);
alter table public.performance_imports enable row level security;
alter table public.performance_measurements enable row level security;
revoke all on public.performance_imports,public.performance_measurements from public,anon,authenticated;
grant select on public.performance_imports,public.performance_measurements to authenticated;
create policy performance_imports_read on public.performance_imports for select to authenticated using((select private.has_role('admin')));
create policy performance_measurements_read on public.performance_measurements for select to authenticated using(private.can_read_athlete(athlete_id));

create function private.import_performance(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r jsonb; key_name text; observation jsonb; athlete uuid; old public.performance_measurements;
  definition private.performance_metric_catalog; measured date; number_value float8;
  row_number integer; column_number integer; receipt uuid; created integer:=0; unchanged integer:=0;
  seen_positions text[]:='{}'; position_key text;
  fields text[]:=array['observation_id','athlete_code','metric_key','measured_at','value','unit','source','source_file','source_sheet','source_row','file_hash'];
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
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
      or number_value<0 or number_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
      or (definition.positive_only and number_value<=0) or (definition.percentage and number_value>100)
      or row_number not between 1 and 1000000 or column_number not between 0 and 10000
      or measured not between '2000-01-01'::date and '2099-12-31'::date then raise exception 'Unsupported metric, unit or value' using errcode='22023'; end if;
    select id into athlete from public.athletes where athlete_code=r->>'athlete_code';
    if athlete is null then raise exception 'Select an existing permanent athlete code' using errcode='22023'; end if;
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
create function public.admin_import_performance(p_rows jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.import_performance(p_rows); $$;

-- No caller-supplied metric, threshold, period or cohort can probe peer values.
create function private.performance_summary(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
  return (
    with cohort as (
      select athlete_id from public.athlete_seasons where season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))
    ), raw as (
      select m.athlete_id,m.metric_key,m.unit,m.value,m.measured_at,m.source,m.file_hash,m.observation_id,m.imported_at,c.direction,c.body_metric
      from public.performance_measurements m join private.performance_metric_catalog c using(metric_key)
      where c.profile_metric and (m.athlete_id=p_athlete_id or exists(select 1 from cohort where athlete_id=m.athlete_id))
      union all
      select muscle.athlete_id,'muscle_mass_pct','%',100.0::float8*(muscle.value/weight.value),muscle.measured_at,muscle.source,muscle.file_hash,
        muscle.observation_id,greatest(muscle.imported_at,weight.imported_at),'neutral',true
      from public.performance_measurements muscle join public.performance_measurements weight
        on weight.athlete_id=muscle.athlete_id and weight.file_hash=muscle.file_hash and weight.measured_at=muscle.measured_at and weight.unit=muscle.unit
      where muscle.metric_key='muscle_mass' and weight.metric_key='weight' and muscle.source='RENPHO' and weight.source='RENPHO'
        and muscle.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$' and weight.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$'
        and weight.value>0 and muscle.value<=weight.value
        and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='weight' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
        and (select count(*) from public.performance_measurements candidate where candidate.athlete_id=muscle.athlete_id and candidate.file_hash=muscle.file_hash and candidate.measured_at=muscle.measured_at and candidate.metric_key='muscle_mass' and candidate.source='RENPHO' and candidate.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')=1
        and (muscle.athlete_id=p_athlete_id or exists(select 1 from cohort where athlete_id=muscle.athlete_id))
        and not exists(select 1 from public.performance_measurements explicit where explicit.athlete_id=muscle.athlete_id and explicit.file_hash=muscle.file_hash and explicit.measured_at=muscle.measured_at and explicit.metric_key='muscle_mass_pct'
          and explicit.source='RENPHO' and explicit.source_sheet ~ '^RENPHO report · Page [1-9][0-9]*$')
    ), periods as (
      select raw.*,case when measured_at between '2026-09-01'::date and '2026-12-31'::date then 'fall_2026'
        when body_metric and measured_at between '2026-06-01'::date and '2026-08-31'::date then 'summer_2026' end as period,
        lower(regexp_replace(btrim(source),'[[:space:]]+',' ','g')) as comparison_source
      from raw
    ), ranked as (
      -- Browser Date timestamps have millisecond precision; use the same tie boundary.
      select periods.*,row_number() over(partition by athlete_id,metric_key,unit,period,comparison_source order by measured_at desc,date_trunc('milliseconds',imported_at) desc,file_hash asc,observation_id asc) as choice
      from periods where period is not null
    ), latest as (select * from ranked where choice=1), summaries as (
      select own.*,stats.n,stats.below,stats.equal
      from latest own cross join lateral (
        select count(*)::integer as n,count(*) filter(where peer.value<own.value)::integer as below,count(*) filter(where peer.value=own.value)::integer as equal
        from latest peer join cohort on cohort.athlete_id=peer.athlete_id
        where peer.metric_key=own.metric_key and peer.unit=own.unit and peer.period=own.period and peer.comparison_source=own.comparison_source
      ) stats where own.athlete_id=p_athlete_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'metricKey',metric_key,'measuredAt',measured_at,'observedValue',value,'unit',unit,'source',source,'period',period,'direction',direction,'sampleSize',n,
      'value',case when n>=5 and exists(select 1 from cohort where athlete_id=p_athlete_id) then
        case when direction='lower' then 100.0-100.0*(below+(equal-1)/2.0)/(n-1) else 100.0*(below+(equal-1)/2.0)/(n-1) end else null end
    ) order by period,metric_key,unit,comparison_source),'[]'::jsonb) from summaries
  );
end;
$$;
create function public.athlete_performance_summary(p_athlete_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.performance_summary(p_athlete_id); $$;
revoke all on function private.import_performance(jsonb),private.performance_summary(uuid) from public,anon,authenticated;
grant execute on function private.import_performance(jsonb),private.performance_summary(uuid) to authenticated;
revoke all on function public.admin_import_performance(jsonb),public.athlete_performance_summary(uuid) from public,anon,authenticated;
grant execute on function public.admin_import_performance(jsonb),public.athlete_performance_summary(uuid) to authenticated;
