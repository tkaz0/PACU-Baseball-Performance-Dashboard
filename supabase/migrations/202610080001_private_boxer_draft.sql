-- Private, owner-scoped Boxer World Series board. No roster/account writes.
create table public.boxer_draft_boards (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  document jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default statement_timestamp(),
  last_request_id uuid not null
);
alter table public.boxer_draft_boards enable row level security;
revoke all on public.boxer_draft_boards from public,anon,authenticated;
grant select on public.boxer_draft_boards to authenticated;
create policy boxer_draft_owner on public.boxer_draft_boards for select to authenticated
  using (owner_id=(select auth.uid()) and (select private.has_role('admin')));

create table private.boxer_draft_revisions (
  owner_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  expected_revision integer not null,
  saved_revision integer not null,
  document jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(owner_id,request_id),
  unique(owner_id,saved_revision)
);
alter table private.boxer_draft_revisions enable row level security;
revoke all on private.boxer_draft_revisions from public,anon,authenticated;

create function private.draft_text(v jsonb,maximum integer,allow_empty boolean default false)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(v)='string' and (v#>>'{}')=btrim(v#>>'{}')
    and length(v#>>'{}') between (case when allow_empty then 0 else 1 end) and maximum
    and (v#>>'{}') !~ '[[:cntrl:]]',false);
$$;

create function private.valid_boxer_draft(d jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare t jsonb; p jsonb; pick jsonb; ids text[]:='{}'; names text[]:='{}'; captains text[]:='{}'; links text[]:='{}'; taken text[]:='{}'; eligible text[]:='{}'; n text;
begin
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>100000
    or (select array_agg(key order by key) from jsonb_object_keys(d) key) is distinct from array['picks','players','teams','title','version']
    or d->'version' is distinct from '1'::jsonb or not private.draft_text(d->'title',100)
    or jsonb_typeof(d->'teams')<>'array' or jsonb_array_length(d->'teams')<>2
    or jsonb_typeof(d->'players')<>'array' or jsonb_array_length(d->'players')>100
    or jsonb_typeof(d->'picks')<>'array' or jsonb_array_length(d->'picks')>100 then return false; end if;
  for t in select value from jsonb_array_elements(d->'teams') loop
    if jsonb_typeof(t)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(t) key) is distinct from array['captains','name']
      or not private.draft_text(t->'name',40) or jsonb_typeof(t->'captains')<>'array' or jsonb_array_length(t->'captains')>4 then return false; end if;
    for p in select value from jsonb_array_elements(t->'captains') loop
      n:=lower(p#>>'{}');
      if not private.draft_text(p,80) or n=any(captains) then return false; end if;
      captains:=array_append(captains,n);
    end loop;
  end loop;
  if lower(d#>>'{teams,0,name}')=lower(d#>>'{teams,1,name}') then return false; end if;
  for p in select value from jsonb_array_elements(d->'players') loop
    if jsonb_typeof(p)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from array['athleteId','group','id','name','positions']
      or not private.draft_text(p->'name',80) or not private.draft_text(p->'positions',40,true)
      or jsonb_typeof(p->'id')<>'string' or (p->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(p->'group')<>'string' or (p->>'group') not in ('Pitchers','Two-Ways','Outfielders','First Base','Infielders','Catchers','Injured / Student Assistants')
      or lower(p->>'id')=any(ids) or lower(p->>'name')=any(names) or lower(p->>'name')=any(captains) then return false; end if;
    if p->'athleteId'<>'null'::jsonb then
      if jsonb_typeof(p->'athleteId')<>'string' or (p->>'athleteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or lower(p->>'athleteId')=any(links) then return false; end if;
      if not exists(select 1 from public.athletes where id=(p->>'athleteId')::uuid) then return false; end if;
      links:=array_append(links,lower(p->>'athleteId'));
    end if;
    ids:=array_append(ids,lower(p->>'id')); names:=array_append(names,lower(p->>'name'));
    if p->>'group'<>'Injured / Student Assistants' then eligible:=array_append(eligible,p->>'id'); end if;
  end loop;
  for pick in select value from jsonb_array_elements(d->'picks') loop
    n:=pick#>>'{}';
    if jsonb_typeof(pick)<>'string' or not n=any(eligible) or lower(n)=any(taken) then return false; end if;
    taken:=array_append(taken,lower(n));
  end loop;
  return true;
exception when others then return false;
end;
$$;

create function private.read_my_boxer_draft() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.has_role('admin') then raise exception 'Private administrator draft required' using errcode='42501'; end if;
  select jsonb_build_object('revision',revision,'document',document,'updatedAt',updated_at,'lastRequestId',last_request_id)
    into result from public.boxer_draft_boards where owner_id=(select auth.uid());
  return result;
end;
$$;
create function public.my_boxer_draft() returns jsonb language sql stable security invoker set search_path='' as $$select private.read_my_boxer_draft();$$;

create function private.save_my_boxer_draft(p_request_id uuid,p_expected_revision integer,p_document jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_board public.boxer_draft_boards; receipt private.boxer_draft_revisions; revision_number integer;
begin
  -- Same account -> roster locking order as the application's other mutations.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Private administrator draft required' using errcode='42501'; end if;
  actor:=(select auth.uid());
  if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or not private.valid_boxer_draft(p_document) then
    raise exception 'Invalid draft details' using errcode='22023';
  end if;
  select * into receipt from private.boxer_draft_revisions where owner_id=actor and request_id=p_request_id;
  if receipt.request_id is not null then
    if receipt.expected_revision<>p_expected_revision or receipt.document<>p_document then raise exception 'Draft retry differs' using errcode='40001'; end if;
    return jsonb_build_object('requestId',p_request_id,'savedRevision',receipt.saved_revision,'board',private.read_my_boxer_draft());
  end if;
  select * into current_board from public.boxer_draft_boards where owner_id=actor for update;
  if coalesce(current_board.revision,0)<>p_expected_revision then raise exception 'Draft changed; reload saved board' using errcode='40001'; end if;
  revision_number:=p_expected_revision+1;
  insert into public.boxer_draft_boards(owner_id,document,revision,updated_at,last_request_id)
    values(actor,p_document,revision_number,statement_timestamp(),p_request_id)
    on conflict(owner_id) do update set document=excluded.document,revision=excluded.revision,updated_at=excluded.updated_at,last_request_id=excluded.last_request_id;
  insert into private.boxer_draft_revisions(owner_id,request_id,expected_revision,saved_revision,document)
    values(actor,p_request_id,p_expected_revision,revision_number,p_document);
  return jsonb_build_object('requestId',p_request_id,'savedRevision',revision_number,'board',private.read_my_boxer_draft());
end;
$$;
create function public.save_my_boxer_draft(p_request_id uuid,p_expected_revision integer,p_document jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.save_my_boxer_draft(p_request_id,p_expected_revision,p_document);$$;

revoke all on function private.draft_text(jsonb,integer,boolean),private.valid_boxer_draft(jsonb),private.read_my_boxer_draft(),public.my_boxer_draft(),
  private.save_my_boxer_draft(uuid,integer,jsonb),public.save_my_boxer_draft(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.read_my_boxer_draft(),public.my_boxer_draft(),private.save_my_boxer_draft(uuid,integer,jsonb),public.save_my_boxer_draft(uuid,integer,jsonb) to authenticated;
