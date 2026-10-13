-- Owner-requested October 13: private Boxer World Series team planning (roster, depth chart,
-- lineups, pitching plan, notes) for the actual signed-in Admin who owns it. Same owner-scoped
-- pattern as the retired draft board: select-only RLS for the owner, ordinary-session saves with
-- optimistic revisions and identical-request retry receipts. It never writes roster identities,
-- accounts or performance data. The draft board tables and data are retained unchanged.
begin;
create table public.bws_team_plans (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  document jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default statement_timestamp(),
  last_request_id uuid not null
);
alter table public.bws_team_plans enable row level security;
revoke all on public.bws_team_plans from public,anon,authenticated;
grant select on public.bws_team_plans to authenticated;
create policy bws_team_plan_owner on public.bws_team_plans for select to authenticated
  using (owner_id=(select auth.uid()) and (select private.has_role('admin')));

create table private.bws_team_plan_revisions (
  owner_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  expected_revision integer not null,
  saved_revision integer not null,
  document jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(owner_id,request_id),
  unique(owner_id,saved_revision)
);
alter table private.bws_team_plan_revisions enable row level security;
revoke all on private.bws_team_plan_revisions from public,anon,authenticated;

-- Structural check; the application validates every field strictly before saving.
create function private.valid_bws_team_plan(d jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare p jsonb; links text[]:='{}'; ids text[]:='{}';
begin
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>150000
    or (select array_agg(key order by key) from jsonb_object_keys(d) key) is distinct from array['depth','games','lineups','name','notes','players','version']
    or d->'version' is distinct from '1'::jsonb or not private.draft_text(d->'name',60)
    or jsonb_typeof(d->'players')<>'array' or jsonb_array_length(d->'players')>40
    or jsonb_typeof(d->'depth')<>'object' or jsonb_typeof(d->'lineups')<>'array' or jsonb_array_length(d->'lineups')>12
    or jsonb_typeof(d->'games')<>'array' or jsonb_array_length(d->'games')>40 or jsonb_typeof(d->'notes')<>'array' or jsonb_array_length(d->'notes')>40 then return false; end if;
  for p in select value from jsonb_array_elements(d->'players') loop
    if jsonb_typeof(p)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from array['athleteId','id','name','role']
      or not private.draft_text(p->'name',80) or (p->>'role') not in ('pitcher','position','two_way')
      or jsonb_typeof(p->'id')<>'string' or (p->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(p->>'id')=any(ids) then return false; end if;
    if p->'athleteId'<>'null'::jsonb then
      if jsonb_typeof(p->'athleteId')<>'string' or (p->>'athleteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or lower(p->>'athleteId')=any(links) or not exists(select 1 from public.athletes where id=(p->>'athleteId')::uuid) then return false; end if;
      links:=array_append(links,lower(p->>'athleteId'));
    end if;
    ids:=array_append(ids,lower(p->>'id'));
  end loop;
  return true;
exception when others then return false;
end;
$$;

create function private.read_my_bws_team_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.has_role('admin') then raise exception 'Private administrator team plan required' using errcode='42501'; end if;
  select jsonb_build_object('revision',revision,'document',document,'updatedAt',updated_at,'lastRequestId',last_request_id)
    into result from public.bws_team_plans where owner_id=(select auth.uid());
  return result;
end;
$$;
create function public.my_bws_team_plan() returns jsonb language sql stable security invoker set search_path='' as $$select private.read_my_bws_team_plan();$$;

create function private.save_my_bws_team_plan(p_request_id uuid,p_expected_revision integer,p_document jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_plan public.bws_team_plans; receipt private.bws_team_plan_revisions; revision_number integer;
begin
  -- Same account -> roster locking order as the application's other mutations.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Private administrator team plan required' using errcode='42501'; end if;
  actor:=(select auth.uid());
  if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or not private.valid_bws_team_plan(p_document) then
    raise exception 'Invalid team plan details' using errcode='22023';
  end if;
  select * into receipt from private.bws_team_plan_revisions where owner_id=actor and request_id=p_request_id;
  if receipt.request_id is not null then
    if receipt.expected_revision<>p_expected_revision or receipt.document<>p_document then raise exception 'Team plan retry differs' using errcode='40001'; end if;
    return jsonb_build_object('requestId',p_request_id,'savedRevision',receipt.saved_revision,'plan',private.read_my_bws_team_plan());
  end if;
  select * into current_plan from public.bws_team_plans where owner_id=actor for update;
  if coalesce(current_plan.revision,0)<>p_expected_revision then raise exception 'Team plan changed; reload saved plan' using errcode='40001'; end if;
  revision_number:=p_expected_revision+1;
  insert into public.bws_team_plans(owner_id,document,revision,updated_at,last_request_id)
    values(actor,p_document,revision_number,statement_timestamp(),p_request_id)
    on conflict(owner_id) do update set document=excluded.document,revision=excluded.revision,updated_at=excluded.updated_at,last_request_id=excluded.last_request_id;
  insert into private.bws_team_plan_revisions(owner_id,request_id,expected_revision,saved_revision,document)
    values(actor,p_request_id,p_expected_revision,revision_number,p_document);
  return jsonb_build_object('requestId',p_request_id,'savedRevision',revision_number,'plan',private.read_my_bws_team_plan());
end;
$$;
create function public.save_my_bws_team_plan(p_request_id uuid,p_expected_revision integer,p_document jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.save_my_bws_team_plan(p_request_id,p_expected_revision,p_document);$$;

revoke all on function private.valid_bws_team_plan(jsonb),private.read_my_bws_team_plan(),public.my_bws_team_plan(),
  private.save_my_bws_team_plan(uuid,integer,jsonb),public.save_my_bws_team_plan(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.read_my_bws_team_plan(),public.my_bws_team_plan(),private.save_my_bws_team_plan(uuid,integer,jsonb),public.save_my_bws_team_plan(uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
