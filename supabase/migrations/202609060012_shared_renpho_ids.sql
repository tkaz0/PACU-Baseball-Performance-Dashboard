-- External report identifiers are separate from permanent athlete and Auth IDs.
-- Installation creates no mappings. Only reviewed additive staff workflows apply them.
create table private.renpho_identity_aliases (
  renpho_id text primary key check (renpho_id ~ '^[A-Z0-9_-]{1,80}$'),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table private.renpho_identity_aliases enable row level security;
revoke all on private.renpho_identity_aliases from public, anon, authenticated;

create function private.normalized_renpho_id(p_report_id text, p_allow_blank boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare normalized text;
begin
  if p_report_id is null or octet_length(p_report_id) > 512 then
    raise exception 'Invalid RENPHO ID' using errcode = '22023';
  end if;
  normalized := upper(regexp_replace(p_report_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'));
  if normalized = '' and p_allow_blank then return ''; end if;
  if normalized !~ '^[A-Z0-9_-]{1,80}$' then
    raise exception 'Invalid RENPHO ID' using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create function private.upsert_renpho_ids(p_mapping jsonb, p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; normalized text; target uuid; previous_owner uuid;
  seen text[] := '{}'; created integer := 0; unchanged integer := 0;
begin
  -- Match the account-before-roster order used by identity and roster writers.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not private.has_role('admin') then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  if p_reviewed is distinct from true then
    raise exception 'Review the RENPHO ID mapping first' using errcode = '22023';
  end if;
  if jsonb_typeof(p_mapping) is distinct from 'array' or jsonb_array_length(p_mapping) not between 1 and 200
    or octet_length(p_mapping::text) > 65536 then
    raise exception 'Provide 1–200 reviewed RENPHO ID mappings' using errcode = '22023';
  end if;
  for r in select value from jsonb_array_elements(p_mapping) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r)) <> 2
      or exists(select 1 from jsonb_object_keys(r) k where k not in ('athlete_code', 'renpho_id'))
      or jsonb_typeof(r->'athlete_code') is distinct from 'string'
      or jsonb_typeof(r->'renpho_id') is distinct from 'string'
      or r->>'athlete_code' !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' then
      raise exception 'Invalid RENPHO mapping fields' using errcode = '22023';
    end if;
    normalized := private.normalized_renpho_id(r->>'renpho_id');
    if normalized = any(seen) then
      raise exception 'Duplicate RENPHO ID in reviewed mapping' using errcode = '22023';
    end if;
    seen := array_append(seen, normalized);
    -- Require the reviewed current code: never infer from a name, email or prefix.
    select id into target from public.athletes where athlete_code = r->>'athlete_code';
    if target is null then
      raise exception 'Select an existing permanent athlete code' using errcode = '22023';
    end if;
    select athlete_id into previous_owner from private.renpho_identity_aliases where renpho_id = normalized;
    if previous_owner is not null and previous_owner <> target then
      raise exception 'RENPHO ID already belongs to another athlete; no mappings changed' using errcode = '23505';
    elsif previous_owner is not null then
      unchanged := unchanged + 1;
    else
      insert into private.renpho_identity_aliases(renpho_id, athlete_id, created_by)
        values(normalized, target, auth.uid());
      created := created + 1;
    end if;
  end loop;
  -- Count-only audit: never copy report IDs into logs, measurements or receipts.
  insert into public.audit_events(actor_id, event_type, details)
    values(auth.uid(), 'renpho_ids_mapped', jsonb_build_object('created', created, 'unchanged', unchanged));
  return jsonb_build_object('created', created, 'unchanged', unchanged);
end;
$$;

create function public.admin_upsert_renpho_ids(p_mapping jsonb, p_reviewed boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.upsert_renpho_ids(p_mapping, p_reviewed);
$$;

create function private.match_renpho_id(p_report_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized text; matched jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active administrator or coach required' using errcode = '42501';
  end if;
  normalized := private.normalized_renpho_id(p_report_id);
  select jsonb_build_object('athlete_id', a.id, 'athlete_code', a.athlete_code) into matched
    from private.renpho_identity_aliases r join public.athletes a on a.id = r.athlete_id
    where r.renpho_id = normalized;
  return matched;
end;
$$;

create function public.staff_match_renpho_id(p_report_id text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.match_renpho_id(p_report_id);
$$;

create function private.import_renpho(p_report_id text, p_athlete_code text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized text; target uuid; matched uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active administrator or coach required' using errcode = '42501';
  end if;
  normalized := private.normalized_renpho_id(p_report_id, true);
  if p_athlete_code is null or p_athlete_code !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$' then
    raise exception 'Select an existing permanent athlete code' using errcode = '22023';
  end if;
  select id into target from public.athletes where athlete_code = p_athlete_code;
  if target is null then
    raise exception 'Select an existing permanent athlete code' using errcode = '22023';
  end if;
  select athlete_id into matched from private.renpho_identity_aliases where renpho_id = normalized;
  if matched is not null and matched <> target then
    raise exception 'RENPHO ID belongs to a different player. Review the report match before saving.' using errcode = '23505';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500
    or octet_length(p_rows::text) > 1048576 then
    raise exception 'Review 1–500 RENPHO observations within 1 MiB' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r) is distinct from 'object'
    or r->>'athlete_code' is distinct from p_athlete_code or r->>'source' is distinct from 'RENPHO') then
    raise exception 'Every RENPHO observation must use the reviewed player and source' using errcode = '22023';
  end if;
  -- Unknown/blank IDs permit explicit manual selection without creating an alias.
  -- The ID is a transient check only; the ordinary numeric whitelist stays intact.
  return private.import_performance(p_rows);
end;
$$;

create function public.staff_import_renpho(p_report_id text, p_athlete_code text, p_rows jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.import_renpho(p_report_id, p_athlete_code, p_rows);
$$;

revoke all on function private.normalized_renpho_id(text, boolean), private.upsert_renpho_ids(jsonb, boolean),
  private.match_renpho_id(text), private.import_renpho(text, text, jsonb) from public, anon, authenticated;
grant execute on function private.upsert_renpho_ids(jsonb, boolean), private.match_renpho_id(text),
  private.import_renpho(text, text, jsonb) to authenticated;
revoke all on function public.admin_upsert_renpho_ids(jsonb, boolean), public.staff_match_renpho_id(text),
  public.staff_import_renpho(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_renpho_ids(jsonb, boolean), public.staff_match_renpho_id(text),
  public.staff_import_renpho(text, text, jsonb) to authenticated;
