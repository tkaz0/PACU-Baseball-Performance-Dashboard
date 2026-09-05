-- An owner-reviewed LOCAL -> PAC prefix change; UUID identity and links stay fixed.
-- Installing this migration changes no athlete codes. Apply the bounded RPC separately.
create table private.athlete_code_aliases (
  old_code text primary key check(old_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);
revoke all on private.athlete_code_aliases from public,anon,authenticated;

create function private.canonical_athlete_code(code text) returns text
language sql stable security definer set search_path='' as $$
  select coalesce((select a.athlete_code from private.athlete_code_aliases x join public.athletes a on a.id=x.athlete_id where x.old_code=code),code);
$$;

create function private.protect_athlete_code_namespace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if exists(select 1 from private.athlete_code_aliases where old_code=new.athlete_code) then
    raise exception 'A previous athlete ID cannot be assigned again' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger protect_athlete_code_namespace before insert or update of athlete_code on public.athletes
for each row execute function private.protect_athlete_code_namespace();

create function private.rename_athlete_codes(p_mapping jsonb,p_reviewed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; target uuid; current_code text; v_old_code text; new_code text; changed integer:=0; unchanged integer:=0;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true then raise exception 'Review the athlete ID mapping first' using errcode='22023'; end if;
  if jsonb_typeof(p_mapping) is distinct from 'array' or jsonb_array_length(p_mapping) not between 1 and 1000 or octet_length(p_mapping::text)>300000 then
    raise exception 'Provide 1–1000 reviewed athlete ID mappings' using errcode='22023';
  end if;
  if (select count(distinct x->>'athlete_id') from jsonb_array_elements(p_mapping) x)<>jsonb_array_length(p_mapping)
    or (select count(distinct x->>'old_code') from jsonb_array_elements(p_mapping) x)<>jsonb_array_length(p_mapping)
    or (select count(distinct x->>'new_code') from jsonb_array_elements(p_mapping) x)<>jsonb_array_length(p_mapping) then
    raise exception 'Duplicate athlete ID mapping' using errcode='22023';
  end if;
  -- Validate the complete snapshot before changing a row or its alias.
  for r in select value from jsonb_array_elements(p_mapping) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>3
      or exists(select 1 from jsonb_object_keys(r) k where k not in ('athlete_id','old_code','new_code'))
      or jsonb_typeof(r->'athlete_id') is distinct from 'string' or jsonb_typeof(r->'old_code') is distinct from 'string'
      or jsonb_typeof(r->'new_code') is distinct from 'string' then raise exception 'Invalid athlete ID mapping fields' using errcode='22023'; end if;
    begin target:=(r->>'athlete_id')::uuid; exception when others then raise exception 'Invalid athlete UUID' using errcode='22023'; end;
    v_old_code:=r->>'old_code'; new_code:=r->>'new_code';
    if v_old_code !~ '^LOCAL-[0-9]{4,9}$' or substring(v_old_code from 7)::integer<1
      or lpad((substring(v_old_code from 7)::integer)::text,greatest(4,length((substring(v_old_code from 7)::integer)::text)),'0')<>substring(v_old_code from 7)
      or new_code<>'PAC-'||substring(v_old_code from 7) then raise exception 'Preserve the exact LOCAL ID number in its PAC ID' using errcode='22023'; end if;
    select athlete_code into current_code from public.athletes where id=target;
    if current_code is null then raise exception 'Mapped athlete no longer exists' using errcode='22023'; end if;
    if current_code=new_code and exists(select 1 from private.athlete_code_aliases x where x.old_code=v_old_code and x.athlete_id=target) then continue; end if;
    if current_code<>v_old_code then raise exception 'Athlete ID changed after review' using errcode='40001'; end if;
    if exists(select 1 from public.athletes where athlete_code=new_code and id<>target)
      or exists(select 1 from private.athlete_code_aliases x where x.old_code in (v_old_code,new_code)) then
      raise exception 'Athlete ID mapping conflicts with an existing or previous ID' using errcode='23505';
    end if;
  end loop;
  for r in select value from jsonb_array_elements(p_mapping) loop
    target:=(r->>'athlete_id')::uuid; v_old_code:=r->>'old_code'; new_code:=r->>'new_code';
    if exists(select 1 from public.athletes where id=target and athlete_code=new_code) then unchanged:=unchanged+1; continue; end if;
    insert into private.athlete_code_aliases(old_code,athlete_id,created_by) values(v_old_code,target,auth.uid());
    update public.athletes set athlete_code=new_code,updated_at=now() where id=target;
    insert into public.audit_events(actor_id,event_type,target_id,details)
      values(auth.uid(),'athlete_code_changed',target,jsonb_build_object('before',v_old_code,'after',new_code));
    changed:=changed+1;
  end loop;
  return jsonb_build_object('changed',changed,'unchanged',unchanged);
end;
$$;
create function public.admin_rename_athlete_codes(p_mapping jsonb,p_reviewed boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.rename_athlete_codes(p_mapping,p_reviewed);$$;

-- Reuse the existing reviewed importer, with aliases resolved before duplicate,
-- email, preview freshness, and immutable observation checks.
alter function private.plan_roster(jsonb,text) rename to plan_roster_original_codes;
create function private.plan_roster(p_rows jsonb,p_season text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized jsonb; planned jsonb; output jsonb:='[]'; r jsonb; item jsonb; a public.athletes; conflict boolean;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>3145728 then
    return private.plan_roster_original_codes(p_rows,p_season);
  end if;
  select jsonb_agg(case when jsonb_typeof(x.value)='object' and jsonb_typeof(x.value->'athlete_code')='string'
    then jsonb_set(x.value,'{athlete_code}',to_jsonb(private.canonical_athlete_code(x.value->>'athlete_code'))) else x.value end order by x.ordinality)
    into normalized from jsonb_array_elements(p_rows) with ordinality x;
  planned:=private.plan_roster_original_codes(normalized,p_season);
  for item in select value from jsonb_array_elements(planned->'rows') loop
    r:=normalized->((item->>'row')::integer-2);
    select * into a from public.athletes where athlete_code=r->>'athlete_code';
    conflict:=a.id is null and r->>'athlete_code' like 'LOCAL-%';
    if a.id is not null and a.athlete_code like 'PAC-%' then
      conflict:= (lower(regexp_replace(btrim(r->>'first_name'),'[[:space:]]+',' ','g'))<>lower(regexp_replace(btrim(a.first_name),'[[:space:]]+',' ','g'))
        or lower(regexp_replace(btrim(r->>'last_name'),'[[:space:]]+',' ','g'))<>lower(regexp_replace(btrim(a.last_name),'[[:space:]]+',' ','g')))
        and not (coalesce(r->>'pacific_email','')<>'' and a.pacific_email is not null and r->>'pacific_email'=a.pacific_email);
    end if;
    if conflict then item:=(item-'before'-'after')||jsonb_build_object('action','reject','changes','[]'::jsonb,
      'errors',(item->'errors')||jsonb_build_array('Athlete ID is unrecognized or belongs to a different identity. Reconcile the roster before importing.')); end if;
    output:=output||jsonb_build_array(item);
  end loop;
  return jsonb_build_object('rows',output,'create',(select count(*) from jsonb_array_elements(output) x where x->>'action'='create'),
    'update',(select count(*) from jsonb_array_elements(output) x where x->>'action'='update'),
    'unchanged',(select count(*) from jsonb_array_elements(output) x where x->>'action'='unchanged'),
    'reject',(select count(*) from jsonb_array_elements(output) x where x->>'action'='reject'));
end;
$$;

alter function private.import_performance(jsonb) rename to import_performance_original_codes;
create function private.import_performance(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    return private.import_performance_original_codes(p_rows);
  end if;
  select jsonb_agg(case when jsonb_typeof(x.value)='object' and jsonb_typeof(x.value->'athlete_code')='string'
    then jsonb_set(x.value,'{athlete_code}',to_jsonb(private.canonical_athlete_code(x.value->>'athlete_code'))) else x.value end order by x.ordinality)
    into normalized from jsonb_array_elements(p_rows) with ordinality x;
  return private.import_performance_original_codes(normalized);
end;
$$;

revoke all on function private.canonical_athlete_code(text),private.protect_athlete_code_namespace(),private.rename_athlete_codes(jsonb,boolean),
  private.plan_roster_original_codes(jsonb,text),private.plan_roster(jsonb,text),private.import_performance_original_codes(jsonb),private.import_performance(jsonb) from public,anon,authenticated;
grant execute on function private.rename_athlete_codes(jsonb,boolean),private.import_performance(jsonb) to authenticated;
revoke all on function public.admin_rename_athlete_codes(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_rename_athlete_codes(jsonb,boolean) to authenticated;
