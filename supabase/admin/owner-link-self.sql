-- OWNER ONLY. Not a migration. Optional, deliberate Admin + Player setup.
-- Run only after confirming both identities. Keep replacements out of source control.
begin;
do $$
declare
  selected_user uuid := 'REPLACE_WITH_YOUR_EXPLICIT_AUTH_USER_UUID';
  selected_athlete uuid := 'REPLACE_WITH_VERIFIED_ATHLETE_UUID';
begin
  perform pg_advisory_xact_lock(72104001);
  if not exists(select 1 from public.app_accounts a join public.account_roles r using(user_id) where a.user_id=selected_user and a.is_active and r.role='admin') then raise exception 'Select an existing active admin'; end if;
  if not exists(select 1 from public.athletes where id=selected_athlete) then raise exception 'Athlete does not exist'; end if;
  if exists(select 1 from public.account_athletes where user_id=selected_user or athlete_id=selected_athlete) then raise exception 'A link already exists. Review it explicitly before changing it.'; end if;
  insert into public.account_roles(user_id,role) values(selected_user,'player') on conflict do nothing;
  insert into public.account_athletes(user_id,athlete_id,linked_by) values(selected_user,selected_athlete,selected_user);
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(selected_user,'owner_add_player_link',selected_user,jsonb_build_object('athlete_id',selected_athlete,'added_role','player'));
end;
$$;
commit;
