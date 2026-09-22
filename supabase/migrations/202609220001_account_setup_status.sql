-- Read-only setup status for already configured accounts. Never return credential material.
begin;
create function private.account_setup_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role('admin') then
  raise exception 'Active administrator required' using errcode='42501';
 end if;
 return (
  select coalesce(jsonb_agg(jsonb_build_object(
   'userId',a.user_id,'active',a.is_active,
   'roles',coalesce((select jsonb_agg(r.role order by r.role) from public.account_roles r where r.user_id=a.user_id),'[]'::jsonb),
   'athleteId',p.id,'code',p.athlete_code,
   'name',coalesce(nullif(concat_ws(' ',coalesce(nullif(p.preferred_name,''),p.first_name),p.last_name),''),c.display_name,u.email,'Configured account'),
   'email',u.email,'invitedAt',u.invited_at,'acceptedAt',u.email_confirmed_at,
   'lastSignInAt',u.last_sign_in_at,
   'passwordSet',coalesce(u.encrypted_password<>'',false)
  ) order by lower(coalesce(p.last_name,c.display_name,u.email,'')),a.user_id),'[]'::jsonb)
  from public.app_accounts a
  join auth.users u on u.id=a.user_id
  left join public.account_athletes l on l.user_id=a.user_id
  left join public.athletes p on p.id=l.athlete_id
  -- This email match supplies a display label only. It never establishes access or identity links.
  left join public.coach_invitation_candidates c on c.email=lower(u.email)
 );
end;
$$;
create function public.admin_account_setup_status() returns jsonb
language sql stable security invoker set search_path='' as $$select private.account_setup_status();$$;
revoke all on function private.account_setup_status(),public.admin_account_setup_status() from public,anon,authenticated;
grant execute on function private.account_setup_status(),public.admin_account_setup_status() to authenticated;
commit;
