-- Sample sizes for reviewed Full Swing session summaries. Original files and measurements stay immutable.
create table private.full_swing_session_samples (
  file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  metric_key text not null,
  unit text not null,
  source_row integer not null check(source_row between 2 and 1000000),
  sample_count integer not null check(sample_count between 1 and 100000),
  created_at timestamptz not null default now(),
  primary key(file_hash,athlete_id,metric_key,unit)
);
alter table private.full_swing_session_samples enable row level security;
revoke all on private.full_swing_session_samples from public,anon,authenticated;

create function public.save_full_swing_session_samples(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; target uuid; old_count integer; created integer:=0; unchanged integer:=0;
  fields text[]:=array['athleteCode','expectedValue','fileHash','metricKey','unit','sourceRow','sampleCount'];
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff access required' using errcode='42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500
    or octet_length(p_rows::text)>1048576 then
    raise exception 'Review 1–500 sample counts' using errcode='22023';
  end if;
  if (select count(distinct jsonb_build_array(x->>'fileHash',x->>'athleteCode',x->>'metricKey',x->>'unit'))
      from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows) then
    raise exception 'Duplicate session sample' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>cardinality(fields)
      or exists(select 1 from jsonb_object_keys(r) k where not k=any(fields))
      or jsonb_typeof(r->'sourceRow') is distinct from 'number' or jsonb_typeof(r->'sampleCount') is distinct from 'number'
      or jsonb_typeof(r->'expectedValue') is distinct from 'number'
      or jsonb_typeof(r->'athleteCode') is distinct from 'string' or jsonb_typeof(r->'fileHash') is distinct from 'string'
      or jsonb_typeof(r->'metricKey') is distinct from 'string' or jsonb_typeof(r->'unit') is distinct from 'string'
      or r->>'athleteCode' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' or r->>'fileHash' !~ '^[a-f0-9]{64}$'
      or r->>'metricKey' not in ('max_exit_velocity','avg_exit_velocity','max_bat_speed','avg_bat_speed','max_distance','max_pitch_velocity','avg_pitch_velocity')
      or r->>'unit' not in ('mph','ft')
      or (r->>'sourceRow')::numeric<>trunc((r->>'sourceRow')::numeric)
      or (r->>'sampleCount')::numeric<>trunc((r->>'sampleCount')::numeric)
      or (r->>'sourceRow')::numeric not between 2 and 1000000
      or (r->>'sampleCount')::numeric not between 1 and 100000
      or (r->>'expectedValue')::numeric not between -10000 and 10000 then
      raise exception 'Invalid Full Swing sample count' using errcode='22023';
    end if;
    select id into target from public.athletes where athlete_code=r->>'athleteCode';
    if target is null or (select count(*) from public.performance_measurements m where m.athlete_id=target
      and m.file_hash=r->>'fileHash' and m.metric_key=r->>'metricKey' and m.unit=r->>'unit'
      and m.source_row=(r->>'sourceRow')::integer and m.source_sheet='CSV · Full Swing session summaries v1'
      and m.source ~ '^Full Swing · (Game|Intrasquad|Practice)$'
      and m.measured_at between date '2026-09-01' and date '2026-12-31'
      and abs(m.value-(r->>'expectedValue')::float8) <= 0.00000001*greatest(1,abs(m.value)))<>1 then
      raise exception 'Sample count has no unique saved Full Swing summary' using errcode='22023';
    end if;
    select sample_count into old_count from private.full_swing_session_samples where file_hash=r->>'fileHash'
      and athlete_id=target and metric_key=r->>'metricKey' and unit=r->>'unit';
    if old_count is not null then
      if old_count<>(r->>'sampleCount')::integer then raise exception 'Saved sample count differs; review original CSV' using errcode='23505'; end if;
      unchanged:=unchanged+1;
    else
      insert into private.full_swing_session_samples(file_hash,athlete_id,metric_key,unit,source_row,sample_count)
      values(r->>'fileHash',target,r->>'metricKey',r->>'unit',(r->>'sourceRow')::integer,(r->>'sampleCount')::integer);
      created:=created+1;
    end if;
  end loop;
  return jsonb_build_object('created',created,'unchanged',unchanged);
end;
$$;
revoke all on function public.save_full_swing_session_samples(jsonb) from public,anon,authenticated;
grant execute on function public.save_full_swing_session_samples(jsonb) to authenticated;
