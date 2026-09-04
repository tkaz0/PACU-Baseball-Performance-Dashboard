-- OWNER ONLY. Not a migration, never run automatically.
-- Confirm the development project, privately create your Auth user, and replace
-- the placeholder below with the exact Auth user UUID you deliberately selected.
-- No lookup by email, ordering, first login, or editable metadata is used.
begin;
do $$
declare selected_user uuid := 'REPLACE_WITH_EXPLICIT_AUTH_USER_UUID';
begin
  perform pg_advisory_xact_lock(72104001);
  if not exists(select 1 from auth.users where id=selected_user) then raise exception 'Selected Auth user does not exist'; end if;
  if exists(select 1 from public.app_accounts a join public.account_roles r on r.user_id=a.user_id where a.is_active and r.role='admin') then
    raise exception 'An active admin already exists. Use the approved account-access workflow.';
  end if;
  insert into public.app_accounts(user_id,is_active) values(selected_user,true) on conflict(user_id) do update set is_active=true;
  insert into public.account_roles(user_id,role) values(selected_user,'admin') on conflict do nothing;
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(selected_user,'owner_bootstrap_admin',selected_user,jsonb_build_object('role','admin','method','Explicit owner-selected Auth UUID'));
end;
$$;
commit;
