-- Preparation records only. Saving a coach never creates Auth users, grants roles,
-- links athletes, or sends an invitation.
create table public.coach_invitation_candidates (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check(length(display_name) between 1 and 160 and display_name=btrim(display_name) and display_name !~ '[[:cntrl:]]'),
  email text not null unique check(length(email)<=254 and email=lower(btrim(email)) and email !~ '[[:cntrl:]]' and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);
alter table public.coach_invitation_candidates enable row level security;
revoke all on public.coach_invitation_candidates from public,anon,authenticated;
grant select on public.coach_invitation_candidates to authenticated;
create policy coach_candidates_admin_read on public.coach_invitation_candidates
for select to authenticated using ((select private.has_role('admin')));

create function private.prepare_coach(p_display_name text,p_email text,p_reviewed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  coach_name text:=btrim(p_display_name);
  coach_email text:=lower(btrim(p_email));
  previous public.coach_invitation_candidates;
  candidate_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_reviewed is distinct from true then raise exception 'Review the coach details before saving' using errcode='22023'; end if;
  if coach_name is null or length(coach_name) not between 1 and 160 or p_display_name ~ '[[:cntrl:]]'
    or coach_email is null or length(coach_email)>254 or p_email ~ '[[:cntrl:]]'
    or coach_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a coach name and valid email address' using errcode='22023';
  end if;
  select * into previous from public.coach_invitation_candidates where email=coach_email;
  if previous.id is not null and previous.display_name=coach_name then return previous.id; end if;
  if previous.id is null and (select count(*) from public.coach_invitation_candidates)>=100 then
    raise exception 'Coach preparation list is full' using errcode='54000';
  end if;
  insert into public.coach_invitation_candidates(display_name,email,created_by)
    values(coach_name,coach_email,auth.uid())
    on conflict(email) do update set display_name=excluded.display_name
    returning id into candidate_id;
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(auth.uid(),'coach_candidate_prepared',candidate_id,jsonb_build_object(
      'before',case when previous.id is null then null else jsonb_build_object('display_name',previous.display_name,'email',previous.email) end,
      'after',jsonb_build_object('display_name',coach_name,'email',coach_email)));
  return candidate_id;
end;
$$;

create function public.admin_prepare_coach(p_display_name text,p_email text,p_reviewed boolean)
returns uuid language sql security invoker set search_path='' as $$
  select private.prepare_coach(p_display_name,p_email,p_reviewed);
$$;
revoke all on function private.prepare_coach(text,text,boolean) from public,anon,authenticated;
grant execute on function private.prepare_coach(text,text,boolean) to authenticated;
revoke all on function public.admin_prepare_coach(text,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_prepare_coach(text,text,boolean) to authenticated;
