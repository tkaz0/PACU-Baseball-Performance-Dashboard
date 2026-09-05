-- Provision approved access for a new invited Auth identity without replacing
-- an existing account. This does not create Auth users or send invitations.
create function private.provision_invited_account(target_user uuid, account_role text, linked_athlete uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Share the account lock with configure_account and roster approvals. Check
  -- authorization and absence only after waiting, within this same transaction.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not private.has_role('admin') then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  if target_user is null then
    raise exception 'Select an existing Auth user ID' using errcode = '22023';
  end if;
  if exists(select 1 from public.app_accounts where user_id = target_user) then
    raise exception 'Account access is already configured. Review the existing account instead.' using errcode = '23505';
  end if;
  if account_role is null or account_role not in ('coach', 'player') then
    raise exception 'Invitations support one Coach or Player role' using errcode = '22023';
  end if;
  if (account_role = 'player' and linked_athlete is null)
    or (account_role = 'coach' and linked_athlete is not null) then
    raise exception 'Player invitations require an athlete link; Coach invitations must have no athlete link' using errcode = '22023';
  end if;
  -- The existing implementation checks Auth existence, unique athlete links,
  -- and self-modification and saves the account, role, link and audit together.
  -- Its acquisition of the same transaction lock is reentrant.
  perform private.configure_account(target_user, true, array[account_role]::text[], linked_athlete);
end;
$$;

create function public.admin_provision_invited_account(target_user uuid, account_role text, linked_athlete uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.provision_invited_account(target_user, account_role, linked_athlete);
$$;

revoke all on function private.provision_invited_account(uuid,text,uuid) from public, anon, authenticated;
grant execute on function private.provision_invited_account(uuid,text,uuid) to authenticated;
revoke all on function public.admin_provision_invited_account(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_provision_invited_account(uuid,text,uuid) to authenticated;
