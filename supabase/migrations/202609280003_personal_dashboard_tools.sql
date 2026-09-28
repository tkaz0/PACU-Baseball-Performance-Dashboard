begin;
create table public.saved_analytics_views (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, config jsonb not null, created_at timestamptz not null default now(), archived_at timestamptz
);
create index saved_analytics_views_owner on public.saved_analytics_views(user_id,created_at desc);
alter table public.saved_analytics_views enable row level security;
revoke all on public.saved_analytics_views from public,anon,authenticated;

create function private.valid_analytics_view(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb; v jsonb;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p)) <> 9 or not p ?& array['version','x','y','period','colorBy','classFilter','positionFilter','window','hidden']
    or p->'version' is distinct from '1'::jsonb or coalesce(p->>'period','') not in ('fall','earlier') or coalesce(p->>'colorBy','') not in ('academicClass','position','playerType','bats','throws','team')
    or coalesce(p->'window','null'::jsonb) not in ('0'::jsonb,'7'::jsonb,'30'::jsonb,'90'::jsonb,'366'::jsonb) or p->>'x'=p->>'y' then return false; end if;
  foreach v in array array[p->'x',p->'y'] loop
    if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>600 or (v#>>'{}')~'[[:cntrl:]]' then return false; end if;
    a := (v#>>'{}')::jsonb;
    if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a)<>3 or exists(select 1 from jsonb_array_elements(a) e where jsonb_typeof(e) is distinct from 'string' or length(e#>>'{}') not between 1 and 300 or (e#>>'{}')~'[[:cntrl:]]') then return false; end if;
  end loop;
  if jsonb_typeof(p->'classFilter') is distinct from 'string' or length(p->>'classFilter')>80 or (p->>'classFilter')~'[[:cntrl:]]' or
    jsonb_typeof(p->'positionFilter') is distinct from 'string' or length(p->>'positionFilter')>80 or (p->>'positionFilter')~'[[:cntrl:]]' or jsonb_typeof(p->'hidden') is distinct from 'array' or jsonb_array_length(p->'hidden')>50 then return false; end if;
  if exists(select 1 from jsonb_array_elements(p->'hidden') e where jsonb_typeof(e) is distinct from 'string' or length(e#>>'{}')>100 or (e#>>'{}')~'[[:cntrl:]]') or
    (select count(*)<>count(distinct e) from jsonb_array_elements(p->'hidden') e) then return false; end if;
  return true;
exception when others then return false;
end; $$;
alter table public.saved_analytics_views add constraint analytics_view_name check(length(name) between 1 and 60 and name=btrim(name) and name!~'[[:cntrl:]]'),
  add constraint analytics_view_config check(private.valid_analytics_view(config) is true);

create function private.read_saved_analytics_views() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'config',config,'createdAt',created_at) order by created_at desc,id) from public.saved_analytics_views where user_id=auth.uid() and archived_at is null),'[]'::jsonb);
end; $$;
create function private.save_analytics_view(p_id uuid,p_name text,p_config jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.saved_analytics_views;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  if p_id is null or p_name is null or private.valid_analytics_view(p_config) is not true then raise exception 'Invalid saved view'; end if;
  select * into existing from public.saved_analytics_views where id=p_id for update;
  if found then
    if existing.user_id=auth.uid() and existing.name=p_name and existing.config=p_config and existing.archived_at is null then return existing.id; end if;
    raise exception 'Saved view request changed';
  end if;
  if (select count(*) from public.saved_analytics_views where user_id=auth.uid() and archived_at is null)>=20 then raise exception 'Archive a view before adding another'; end if;
  insert into public.saved_analytics_views(id,user_id,name,config) values(p_id,auth.uid(),p_name,p_config);
  return p_id;
end; $$;
create function private.archive_analytics_view(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  update public.saved_analytics_views set archived_at=coalesce(archived_at,now()) where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Saved view not found'; end if;
  return true;
end; $$;
create function public.my_saved_analytics_views() returns jsonb language sql stable security invoker set search_path='' as $$select private.read_saved_analytics_views();$$;
create function public.save_my_analytics_view(p_id uuid,p_name text,p_config jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_analytics_view(p_id,p_name,p_config);$$;
create function public.archive_my_analytics_view(p_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.archive_analytics_view(p_id);$$;

create table public.dashboard_visits (
  user_id uuid not null references auth.users(id) on delete cascade, scope text not null,
  seen_at timestamptz not null, previous_seen_at timestamptz,
  primary key(user_id,scope), check(previous_seen_at is null or previous_seen_at<=seen_at)
);
alter table public.dashboard_visits enable row level security;
revoke all on public.dashboard_visits from public,anon,authenticated;
create function private.can_use_dashboard_scope(p_scope text) returns boolean language sql stable security definer set search_path='' as $$
  select case when p_scope='staff' then private.has_role('admin') or private.has_role('coach')
    when p_scope ~ '^athlete:[0-9a-f-]{36}$' then private.can_read_athlete(substring(p_scope from 9)::uuid)
    else false end;
$$;
create function private.read_dashboard_visit(p_scope text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if private.can_use_dashboard_scope(p_scope) is not true then raise exception 'Dashboard access denied' using errcode='42501'; end if;
  return (select jsonb_build_object('seenAt',seen_at,'previousSeenAt',previous_seen_at) from public.dashboard_visits where user_id=auth.uid() and scope=p_scope);
end; $$;
create function private.record_dashboard_visit(p_scope text,p_viewed_at timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare existing public.dashboard_visits;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if private.can_use_dashboard_scope(p_scope) is not true then raise exception 'Dashboard access denied' using errcode='42501'; end if;
  if p_viewed_at is null or p_viewed_at>now() or p_viewed_at<now()-interval '15 minutes' then raise exception 'Refresh the dashboard'; end if;
  select * into existing from public.dashboard_visits where user_id=auth.uid() and scope=p_scope for update;
  if not found then insert into public.dashboard_visits(user_id,scope,seen_at) values(auth.uid(),p_scope,p_viewed_at);
  elsif p_viewed_at>existing.seen_at then update public.dashboard_visits set previous_seen_at=case when p_viewed_at-existing.seen_at>interval '30 minutes' then existing.seen_at else existing.previous_seen_at end,seen_at=p_viewed_at where user_id=auth.uid() and scope=p_scope;
  end if;
  return true;
end; $$;
create function public.my_dashboard_visit(p_scope text) returns jsonb language sql stable security invoker set search_path='' as $$select private.read_dashboard_visit(p_scope);$$;
create function public.record_my_dashboard_visit(p_scope text,p_viewed_at timestamptz) returns boolean language sql security invoker set search_path='' as $$select private.record_dashboard_visit(p_scope,p_viewed_at);$$;
revoke all on function private.valid_analytics_view(jsonb) from public,anon,authenticated;
revoke all on function private.read_saved_analytics_views(),private.save_analytics_view(uuid,text,jsonb),private.archive_analytics_view(uuid),
  public.my_saved_analytics_views(),public.save_my_analytics_view(uuid,text,jsonb),public.archive_my_analytics_view(uuid),
  private.can_use_dashboard_scope(text),private.read_dashboard_visit(text),private.record_dashboard_visit(text,timestamptz),public.my_dashboard_visit(text),public.record_my_dashboard_visit(text,timestamptz) from public,anon,authenticated;
grant execute on function private.read_saved_analytics_views(),private.save_analytics_view(uuid,text,jsonb),private.archive_analytics_view(uuid),
  public.my_saved_analytics_views(),public.save_my_analytics_view(uuid,text,jsonb),public.archive_my_analytics_view(uuid),
  private.read_dashboard_visit(text),private.record_dashboard_visit(text,timestamptz),public.my_dashboard_visit(text),public.record_my_dashboard_visit(text,timestamptz) to authenticated;
commit;
