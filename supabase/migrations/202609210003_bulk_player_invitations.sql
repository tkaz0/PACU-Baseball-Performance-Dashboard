-- Durable bulk-send reservations. No Auth users, roles, links or emails are created by this migration.
begin;
create table private.player_invite_attempts (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null unique references public.athletes(id) on delete restrict,
 email text not null unique,
 actor_id uuid not null references auth.users(id),
 status text not null default 'attempted' check(status in ('attempted','sent')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table private.player_invite_attempts enable row level security;
revoke all on private.player_invite_attempts from public,anon,authenticated;
create function private.player_invite_history() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('athlete_id',athlete_id,'status',status) order by created_at),'[]'::jsonb) from private.player_invite_attempts);
end;
$$;
create function private.claim_player_invite(p_athlete uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if p_athlete is null or p_email is null or length(p_email)>254 or p_email<>lower(p_email) or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid recipient'; end if;
 if exists(select 1 from private.player_invite_attempts where athlete_id=p_athlete or email=p_email) or exists(select 1 from public.account_athletes where athlete_id=p_athlete) then return jsonb_build_object('claimed',false); end if;
 if not exists(select 1 from public.athletes a join public.athlete_seasons s on s.athlete_id=a.id where a.id=p_athlete and a.pacific_email=p_email and s.season='2026-27' and (s.roster_status is null or s.roster_status in ('active','redshirt'))) then raise exception 'Roster recipient changed'; end if;
 if (select count(*) from public.athletes where pacific_email=p_email)<>1 then raise exception 'Ambiguous recipient'; end if;
 insert into private.player_invite_attempts(athlete_id,email,actor_id) values(p_athlete,p_email,auth.uid()) returning id into result_id;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'bulk_player_invite_reserved',jsonb_build_object('count',1));
 return jsonb_build_object('claimed',true,'id',result_id);
end;
$$;
create function private.finish_player_invite(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $$
declare attempt private.player_invite_attempts;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select * into attempt from private.player_invite_attempts where id=p_attempt;
 if attempt.id is null or attempt.actor_id<>auth.uid() then raise exception 'Unknown invitation attempt'; end if;
 if not exists(select 1 from public.account_athletes l join public.app_accounts a on a.user_id=l.user_id join public.account_roles r on r.user_id=a.user_id where l.athlete_id=attempt.athlete_id and a.is_active and r.role='player') then raise exception 'Player access not verified'; end if;
 update private.player_invite_attempts set status='sent',finished_at=coalesce(finished_at,now()) where id=p_attempt;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'bulk_player_invite_completed',jsonb_build_object('count',1));
end;
$$;
create function public.admin_player_invite_attempts() returns jsonb language sql security invoker set search_path='' as $$select private.player_invite_history();$$;
create function public.admin_claim_player_invite(p_athlete uuid,p_email text) returns jsonb language sql security invoker set search_path='' as $$select private.claim_player_invite(p_athlete,p_email);$$;
create function public.admin_finish_player_invite(p_attempt uuid) returns void language sql security invoker set search_path='' as $$select private.finish_player_invite(p_attempt);$$;
revoke all on function private.player_invite_history(),private.claim_player_invite(uuid,text),private.finish_player_invite(uuid),public.admin_player_invite_attempts(),public.admin_claim_player_invite(uuid,text),public.admin_finish_player_invite(uuid) from public,anon,authenticated;
grant execute on function private.player_invite_history(),private.claim_player_invite(uuid,text),private.finish_player_invite(uuid),public.admin_player_invite_attempts(),public.admin_claim_player_invite(uuid,text),public.admin_finish_player_invite(uuid) to authenticated;
commit;
