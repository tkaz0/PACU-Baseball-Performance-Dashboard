-- Reviewed correction of one recorded weight, preserving identity and provenance.
create table private.weight_corrections (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  request jsonb not null,
  original_observation jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.weight_corrections enable row level security;
revoke all on private.weight_corrections from public, anon, authenticated;

create function private.correct_recorded_weight(p_request jsonb, p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old public.performance_measurements; prior private.weight_corrections;
  correction_id uuid; athlete uuid; expected_value double precision; corrected_value double precision; receipt jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true or jsonb_typeof(p_request) is distinct from 'object'
    or octet_length(p_request::text) > 8192
    or (select count(*) from jsonb_object_keys(p_request)) <> 5
    or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('requestId','athleteId','observationId','expectedValue','value'))
    or jsonb_typeof(p_request->'requestId') is distinct from 'string'
    or jsonb_typeof(p_request->'athleteId') is distinct from 'string'
    or p_request->>'requestId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_request->>'athleteId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_request->'observationId') is distinct from 'string'
    or length(p_request->>'observationId') not between 1 and 2000
    or jsonb_typeof(p_request->'expectedValue') is distinct from 'number'
    or jsonb_typeof(p_request->'value') is distinct from 'number' then
    raise exception 'Review the exact recorded weight' using errcode='22023';
  end if;
  correction_id := (p_request->>'requestId')::uuid; athlete := (p_request->>'athleteId')::uuid;
  expected_value := (p_request->>'expectedValue')::double precision; corrected_value := (p_request->>'value')::double precision;
  if corrected_value <= 0 or corrected_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
    or expected_value < 0 or expected_value in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8)
    or expected_value = corrected_value then raise exception 'Enter a different positive weight' using errcode='22023'; end if;
  select * into prior from private.weight_corrections c where c.request_id = correction_id;
  if prior.request_id is not null then
    if prior.actor_id <> auth.uid() or prior.request <> p_request then raise exception 'Correction request already used' using errcode='23505'; end if;
    return prior.receipt;
  end if;
  select * into old from public.performance_measurements where observation_id = p_request->>'observationId' for update;
  if old.id is null or old.athlete_id <> athlete or old.value <> expected_value or old.metric_key <> 'weight'
    or old.unit not in ('lb','kg') then raise exception 'The recorded weight changed; refresh and review again' using errcode='40001'; end if;
  update public.performance_measurements set value = corrected_value where id = old.id;
  receipt := jsonb_build_object('requestId', p_request->>'requestId', 'corrected', 1);
  insert into private.weight_corrections(request_id,actor_id,request,original_observation,receipt)
    values(correction_id,auth.uid(),p_request,to_jsonb(old),receipt);
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(auth.uid(),'recorded_weight_corrected',old.id,jsonb_build_object('corrected',1));
  return receipt;
end;
$$;
create function public.admin_correct_recorded_weight(p_request jsonb, p_reviewed boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.correct_recorded_weight(p_request,p_reviewed); $$;
revoke all on function private.correct_recorded_weight(jsonb,boolean), public.admin_correct_recorded_weight(jsonb,boolean) from public, anon, authenticated;
grant execute on function private.correct_recorded_weight(jsonb,boolean), public.admin_correct_recorded_weight(jsonb,boolean) to authenticated;
