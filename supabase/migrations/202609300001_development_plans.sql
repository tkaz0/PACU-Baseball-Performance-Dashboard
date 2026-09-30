begin;

create function private.valid_development_drills(p_drills jsonb,p_saved boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare d jsonb;
begin
  if p_saved is null or p_drills is null or jsonb_typeof(p_drills) is distinct from 'array' or jsonb_array_length(p_drills) not between 1 and 4 then return false; end if;
  for d in select value from jsonb_array_elements(p_drills) loop
    if jsonb_typeof(d) is distinct from 'object' or (select count(*) from jsonb_object_keys(d))<>(case when p_saved then 4 else 3 end) or
      not d ?& array['id','title','cue'] or (p_saved and not d ? 'completedAt') or jsonb_typeof(d->'id') is distinct from 'string' or
      coalesce(d->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or
      jsonb_typeof(d->'title') is distinct from 'string' or length(d->>'title') not between 1 and 120 or d->>'title'<>btrim(d->>'title') or d->>'title'~'[[:cntrl:]]' or
      (d->'cue'<>'null'::jsonb and (jsonb_typeof(d->'cue') is distinct from 'string' or length(d->>'cue') not between 1 and 300 or d->>'cue'<>btrim(d->>'cue') or d->>'cue'~'[[:cntrl:]]')) then return false; end if;
    if p_saved and d->'completedAt'<>'null'::jsonb then
      if jsonb_typeof(d->'completedAt') is distinct from 'string' or not isfinite((d->>'completedAt')::timestamptz) then return false; end if;
    end if;
  end loop;
  return (select count(*)=count(distinct lower(value->>'id')) from jsonb_array_elements(p_drills));
exception when others then return false;
end; $$;

create table public.player_development_plans (
  id uuid primary key,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  week_start date not null check(week_start between date '2026-08-31' and date '2027-12-27' and extract(isodow from week_start)=1),
  focus text not null check(length(focus) between 1 and 120 and focus=btrim(focus) and focus!~'[[:cntrl:]]'),
  drills jsonb not null check(private.valid_development_drills(drills,true) is true),
  staff_note text check(length(staff_note) between 1 and 600 and staff_note=btrim(staff_note) and staff_note!~'[[:cntrl:]]'),
  shared_with_player boolean not null default false,
  archived boolean not null default false,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(athlete_id,week_start)
);
create index player_development_plan_athlete on public.player_development_plans(athlete_id,week_start desc);
alter table public.player_development_plans enable row level security;
revoke all on public.player_development_plans from public,anon,authenticated;

create table private.development_plan_requests (
  actor_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,payload_hash text not null,result jsonb not null,
  created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table private.development_plan_requests enable row level security;
revoke all on private.development_plan_requests from public,anon,authenticated;

create function private.read_development_plans(p_athlete_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare staff boolean;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
  staff:=private.has_role('admin') or private.has_role('coach');
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'athleteId',p.athlete_id,'weekStart',p.week_start,'focus',p.focus,'drills',p.drills,
    'staffNote',case when staff then p.staff_note else null end,'shared',p.shared_with_player,'archived',p.archived,'revision',p.revision,'createdAt',p.created_at,'updatedAt',p.updated_at) order by p.week_start desc,p.id)
    from public.player_development_plans p where p.athlete_id=p_athlete_id and (staff or (p.shared_with_player and not p.archived))),'[]'::jsonb);
end; $$;
create function public.athlete_development_plans(p_athlete_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.read_development_plans(p_athlete_id);$$;

create function private.save_development_plan(p_athlete_id uuid,p_plan_id uuid,p_request_id uuid,p_expected_revision integer,p_week_start date,p_focus text,p_drills jsonb,p_staff_note text,p_shared boolean,p_archived boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.player_development_plans; receipt private.development_plan_requests; payload_hash text; saved_drills jsonb; result jsonb; next_revision integer; clean_focus text; clean_note text;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  clean_focus:=btrim(coalesce(p_focus,''));clean_note:=nullif(btrim(coalesce(p_staff_note,'')),'');
  if p_athlete_id is null or p_plan_id is null or p_plan_id::text!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or p_request_id is null or p_expected_revision is null or p_expected_revision<0 or
    p_week_start is null or p_week_start not between date '2026-08-31' and date '2027-12-27' or extract(isodow from p_week_start)<>1 or
    length(clean_focus) not between 1 and 120 or clean_focus~'[[:cntrl:]]' or length(coalesce(clean_note,''))>600 or clean_note~'[[:cntrl:]]' or
    p_shared is null or p_archived is null or private.valid_development_drills(p_drills,false) is not true then raise exception 'Invalid weekly plan'; end if;
  if not exists(select 1 from public.athletes where id=p_athlete_id) then raise exception 'Unknown athlete'; end if;
  payload_hash:=encode(sha256(convert_to(jsonb_build_object('action','save','athlete',p_athlete_id,'plan',p_plan_id,'revision',p_expected_revision,'week',p_week_start,'focus',clean_focus,'drills',p_drills,'note',clean_note,'shared',p_shared,'archived',p_archived)::text,'UTF8')),'hex');
  select * into receipt from private.development_plan_requests where actor_id=auth.uid() and request_id=p_request_id;
  if found then
    if receipt.payload_hash<>payload_hash then raise exception 'Request changed; review the plan again' using errcode='40001'; end if;
    return receipt.result;
  end if;
  select * into existing from public.player_development_plans where id=p_plan_id for update;
  if found then
    if existing.athlete_id<>p_athlete_id or existing.revision<>p_expected_revision or existing.week_start<>p_week_start then raise exception 'Plan changed; refresh before saving' using errcode='40001'; end if;
  elsif p_expected_revision<>0 then raise exception 'Plan changed; refresh before saving' using errcode='40001';
  elsif exists(select 1 from public.player_development_plans where athlete_id=p_athlete_id and week_start=p_week_start) then raise exception 'This week already has a plan; refresh before editing' using errcode='40001';
  elsif (select count(*) from public.player_development_plans where athlete_id=p_athlete_id)>=104 then raise exception 'Weekly plan limit reached';
  end if;
  -- Preserve player completions only when that exact drill's title and cue remain unchanged.
  select jsonb_agg(jsonb_build_object('id',lower(d.value->>'id'),'title',d.value->>'title','cue',d.value->'cue','completedAt',coalesce((select old->'completedAt' from jsonb_array_elements(coalesce(existing.drills,'[]'::jsonb)) old where lower(old->>'id')=lower(d.value->>'id') and old->>'title'=d.value->>'title' and old->'cue'=d.value->'cue'),'null'::jsonb)) order by d.ordinality)
    into saved_drills from jsonb_array_elements(p_drills) with ordinality d;
  next_revision:=p_expected_revision+1;
  if existing.id is null then
    insert into public.player_development_plans(id,athlete_id,week_start,focus,drills,staff_note,shared_with_player,archived,created_by)
    values(p_plan_id,p_athlete_id,p_week_start,clean_focus,saved_drills,clean_note,p_shared,p_archived,auth.uid());
  else
    update public.player_development_plans set focus=clean_focus,drills=saved_drills,staff_note=clean_note,shared_with_player=p_shared,archived=p_archived,revision=next_revision,updated_at=now() where id=p_plan_id;
  end if;
  result:=jsonb_build_object('id',p_plan_id,'revision',next_revision);
  insert into private.development_plan_requests(actor_id,request_id,payload_hash,result) values(auth.uid(),p_request_id,payload_hash,result);
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'development_plan_saved',p_athlete_id,jsonb_build_object('plan_id',p_plan_id,'revision',next_revision,'drills',jsonb_array_length(saved_drills),'shared',p_shared,'archived',p_archived));
  return result;
end; $$;
create function public.staff_save_development_plan(p_athlete_id uuid,p_plan_id uuid,p_request_id uuid,p_expected_revision integer,p_week_start date,p_focus text,p_drills jsonb,p_staff_note text,p_shared boolean,p_archived boolean)
returns jsonb language sql security invoker set search_path='' as $$select private.save_development_plan(p_athlete_id,p_plan_id,p_request_id,p_expected_revision,p_week_start,p_focus,p_drills,p_staff_note,p_shared,p_archived);$$;

create function private.complete_development_drill(p_athlete_id uuid,p_plan_id uuid,p_request_id uuid,p_expected_revision integer,p_drill_id uuid,p_completed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.player_development_plans; receipt private.development_plan_requests; payload_hash text; saved_drills jsonb; result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('player') or not exists(select 1 from public.account_athletes where user_id=auth.uid() and athlete_id=p_athlete_id) then raise exception 'Own player access required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if p_plan_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<1 or p_drill_id is null or p_completed is null then raise exception 'Invalid drill completion'; end if;
  select * into existing from public.player_development_plans where id=p_plan_id and athlete_id=p_athlete_id for update;
  if not found or not existing.shared_with_player or existing.archived then raise exception 'Shared plan access required' using errcode='42501'; end if;
  payload_hash:=encode(sha256(convert_to(jsonb_build_object('action','complete','athlete',p_athlete_id,'plan',p_plan_id,'revision',p_expected_revision,'drill',p_drill_id,'completed',p_completed)::text,'UTF8')),'hex');
  select * into receipt from private.development_plan_requests where actor_id=auth.uid() and request_id=p_request_id;
  if found then
    if receipt.payload_hash<>payload_hash then raise exception 'Request changed; review the plan again' using errcode='40001'; end if;
    return receipt.result;
  end if;
  if existing.revision<>p_expected_revision then raise exception 'Plan changed; refresh before checking this drill' using errcode='40001'; end if;
  if not exists(select 1 from jsonb_array_elements(existing.drills) d where d->>'id'=p_drill_id::text) then raise exception 'Drill no longer available'; end if;
  select jsonb_agg(case when d.value->>'id'=p_drill_id::text then jsonb_set(d.value,'{completedAt}',case when p_completed then coalesce(nullif(d.value->'completedAt','null'::jsonb),to_jsonb(now())) else 'null'::jsonb end) else d.value end order by d.ordinality)
    into saved_drills from jsonb_array_elements(existing.drills) with ordinality d;
  update public.player_development_plans set drills=saved_drills,revision=revision+1,updated_at=now() where id=p_plan_id;
  result:=jsonb_build_object('id',p_plan_id,'revision',p_expected_revision+1);
  insert into private.development_plan_requests(actor_id,request_id,payload_hash,result) values(auth.uid(),p_request_id,payload_hash,result);
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'development_drill_completed',p_athlete_id,jsonb_build_object('plan_id',p_plan_id,'drill_id',p_drill_id,'revision',p_expected_revision+1,'completed',p_completed));
  return result;
end; $$;
create function public.complete_my_development_drill(p_athlete_id uuid,p_plan_id uuid,p_request_id uuid,p_expected_revision integer,p_drill_id uuid,p_completed boolean)
returns jsonb language sql security invoker set search_path='' as $$select private.complete_development_drill(p_athlete_id,p_plan_id,p_request_id,p_expected_revision,p_drill_id,p_completed);$$;

revoke all on function private.valid_development_drills(jsonb,boolean),private.read_development_plans(uuid),public.athlete_development_plans(uuid),private.save_development_plan(uuid,uuid,uuid,integer,date,text,jsonb,text,boolean,boolean),public.staff_save_development_plan(uuid,uuid,uuid,integer,date,text,jsonb,text,boolean,boolean),private.complete_development_drill(uuid,uuid,uuid,integer,uuid,boolean),public.complete_my_development_drill(uuid,uuid,uuid,integer,uuid,boolean) from public,anon,authenticated;
grant execute on function private.read_development_plans(uuid),public.athlete_development_plans(uuid),private.save_development_plan(uuid,uuid,uuid,integer,date,text,jsonb,text,boolean,boolean),public.staff_save_development_plan(uuid,uuid,uuid,integer,date,text,jsonb,text,boolean,boolean),private.complete_development_drill(uuid,uuid,uuid,integer,uuid,boolean),public.complete_my_development_drill(uuid,uuid,uuid,integer,uuid,boolean) to authenticated;
commit;
