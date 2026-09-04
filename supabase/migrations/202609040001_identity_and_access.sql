-- Phase 1 only. No Auth users or seed data are created by migrations.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.app_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.account_roles (
  user_id uuid not null references public.app_accounts(user_id) on delete restrict,
  role text not null check (role in ('admin', 'coach', 'player')),
  primary key (user_id, role)
);
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  athlete_code text not null unique check (athlete_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  first_name text not null check (length(first_name) between 1 and 80),
  preferred_name text check (length(preferred_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  pacific_email text check (pacific_email = lower(pacific_email) and length(pacific_email) <= 254 and pacific_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  profile_photo_url text check (length(profile_photo_url) <= 2048 and profile_photo_url ~ '^https://([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}([/?#][^[:space:][:cntrl:]]*)?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index athletes_email_unique on public.athletes(lower(pacific_email)) where pacific_email is not null;
create table public.athlete_seasons (
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  season text not null check (season ~ '^20[0-9]{2}(-[0-9]{2})?$'),
  jersey_number smallint check (jersey_number between 0 and 99),
  primary_position text check (primary_position in ('P','C','1B','2B','3B','SS','LF','CF','RF','OF','IF','DH','UT')),
  secondary_position text check (secondary_position in ('P','C','1B','2B','3B','SS','LF','CF','RF','OF','IF','DH','UT')),
  player_type text check (player_type in ('pitcher','position','two_way')),
  bats text check (bats in ('L','R','S')),
  throws text check (throws in ('L','R','S')),
  academic_class text check (academic_class in ('freshman','sophomore','junior','senior','graduate')),
  eligibility_year smallint check (eligibility_year between 1 and 6),
  graduation_year smallint check (graduation_year between 2000 and 2100),
  roster_status text check (roster_status in ('active','inactive','redshirt','alumni')),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, season)
);
create index athlete_seasons_season_idx on public.athlete_seasons(season);
create table public.account_athletes (
  user_id uuid primary key references public.app_accounts(user_id) on delete restrict,
  athlete_id uuid not null unique references public.athletes(id) on delete restrict,
  linked_by uuid references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now()
);
create table public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  season text not null,
  filename text not null,
  source_sha256 text not null,
  input_rows jsonb not null,
  preview jsonb not null,
  status text not null default 'draft' check (status in ('draft','applied')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by uuid references auth.users(id) on delete restrict
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  target_id uuid,
  import_id uuid references public.roster_imports(id) on delete restrict,
  details jsonb not null,
  created_at timestamptz not null default now()
);

-- No JWT roles or user metadata are trusted. These read current trusted records.
create function private.is_active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_accounts where user_id = (select auth.uid()) and is_active);
$$;
create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and exists(select 1 from public.account_roles where user_id = (select auth.uid()) and role = wanted);
$$;
create function private.can_read_athlete(wanted uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active() and (private.has_role('admin') or private.has_role('coach') or
    (private.has_role('player') and exists(select 1 from public.account_athletes where user_id = (select auth.uid()) and athlete_id = wanted)));
$$;

alter table public.app_accounts enable row level security;
alter table public.account_roles enable row level security;
alter table public.account_athletes enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_seasons enable row level security;
alter table public.roster_imports enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.app_accounts, public.account_roles, public.account_athletes, public.athletes,
  public.athlete_seasons, public.roster_imports, public.audit_events from public, anon, authenticated;
grant select on public.app_accounts, public.account_roles, public.account_athletes, public.athletes,
  public.athlete_seasons, public.roster_imports, public.audit_events to authenticated;

create policy accounts_read on public.app_accounts for select to authenticated using
  ((select private.has_role('admin')) or (user_id = (select auth.uid()) and (select private.is_active())));
create policy roles_read on public.account_roles for select to authenticated using
  ((select private.has_role('admin')) or (user_id = (select auth.uid()) and (select private.is_active())));
create policy links_read on public.account_athletes for select to authenticated using
  ((select private.has_role('admin')) or (user_id = (select auth.uid()) and (select private.is_active())));
create policy athletes_read on public.athletes for select to authenticated using (private.can_read_athlete(id));
create policy seasons_read on public.athlete_seasons for select to authenticated using (private.can_read_athlete(athlete_id));
create policy imports_read on public.roster_imports for select to authenticated using ((select private.has_role('admin')));
create policy audit_read on public.audit_events for select to authenticated using ((select private.has_role('admin')));

-- All writes are narrow, audited RPCs; table writes have neither grants nor policies.
create function private.configure_account(target_user uuid, active boolean, roles text[], linked_athlete uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous jsonb;
begin
  -- Serializes changes and avoids self-lockout / races with concurrent admin changes.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode = '42501'; end if;
  if target_user is null or target_user = auth.uid() then raise exception 'Use another administrator to change your own access'; end if;
  if active is null or roles is null or cardinality(roles) < 1 or cardinality(roles) > 3
    or exists(select 1 from unnest(roles) r where r is null or r not in ('admin','coach','player'))
    or (select count(distinct r) from unnest(roles) r) <> cardinality(roles) then raise exception 'Invalid roles'; end if;
  if not exists(select 1 from auth.users where id = target_user) then raise exception 'Select an existing Auth user ID'; end if;
  if linked_athlete is not null and not ('player' = any(roles)) then raise exception 'An athlete link requires the player role'; end if;
  if linked_athlete is not null and not exists(select 1 from public.athletes where id = linked_athlete) then raise exception 'Athlete does not exist'; end if;
  if linked_athlete is not null and exists(select 1 from public.account_athletes where athlete_id = linked_athlete and user_id <> target_user) then raise exception 'Athlete is already linked to another account'; end if;
  select jsonb_build_object('account', to_jsonb(a), 'roles', (select jsonb_agg(role order by role) from public.account_roles where user_id = target_user), 'athlete_id', (select athlete_id from public.account_athletes where user_id = target_user)) into previous from public.app_accounts a where a.user_id = target_user;
  insert into public.app_accounts(user_id, is_active) values (target_user, active) on conflict (user_id) do update set is_active = excluded.is_active;
  delete from public.account_roles where user_id = target_user;
  insert into public.account_roles(user_id, role) select target_user, r from unnest(roles) r;
  delete from public.account_athletes where user_id = target_user;
  if linked_athlete is not null then insert into public.account_athletes(user_id, athlete_id, linked_by) values (target_user, linked_athlete, auth.uid()); end if;
  insert into public.audit_events(actor_id, event_type, target_id, details) values
    (auth.uid(), 'account_configured', target_user, jsonb_build_object('before', previous, 'after', jsonb_build_object('active', active, 'roles', roles, 'athlete_id', linked_athlete)));
end;
$$;
create function public.admin_configure_account(target_user uuid, active boolean, roles text[], linked_athlete uuid default null)
returns void language sql security invoker set search_path = '' as $$ select private.configure_account(target_user, active, roles, linked_athlete); $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active(), private.has_role(text), private.can_read_athlete(uuid), private.configure_account(uuid,boolean,text[],uuid) to authenticated;
revoke all on function public.admin_configure_account(uuid,boolean,text[],uuid) from public, anon;
grant execute on function public.admin_configure_account(uuid,boolean,text[],uuid) to authenticated;
