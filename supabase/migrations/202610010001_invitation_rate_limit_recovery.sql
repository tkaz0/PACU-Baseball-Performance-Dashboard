-- Preserve uncertain attempts; only explicitly rejected sends can return to review.
-- A rejected attempt sent no email, so a corrected roster email may replace it on the next reviewed claim.
begin;
alter table private.player_invite_attempts drop constraint player_invite_attempts_status_check;
alter table private.player_invite_attempts add constraint player_invite_attempts_status_check check(status in ('attempted','sent','rate_limited'));
create or replace function private.claim_player_invite(p_athlete uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if p_athlete is null or p_email is null or length(p_email)>254 or p_email<>lower(p_email) or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid recipient'; end if;
 if exists(select 1 from private.player_invite_attempts where (athlete_id=p_athlete and status<>'rate_limited') or (email=p_email and athlete_id<>p_athlete)) or exists(select 1 from public.account_athletes where athlete_id=p_athlete) then return jsonb_build_object('claimed',false); end if;
 if not exists(select 1 from public.athletes a join public.athlete_seasons s on s.athlete_id=a.id where a.id=p_athlete and a.pacific_email=p_email and s.season='2026-27' and (s.roster_status is null or s.roster_status in ('active','redshirt'))) then raise exception 'Roster recipient changed'; end if;
 if (select count(*) from public.athletes where pacific_email=p_email)<>1 then raise exception 'Ambiguous recipient'; end if;
 insert into private.player_invite_attempts(athlete_id,email,actor_id) values(p_athlete,p_email,auth.uid()) on conflict(athlete_id) do update set id=gen_random_uuid(),email=excluded.email,actor_id=auth.uid(),status='attempted',created_at=now(),finished_at=null where player_invite_attempts.status='rate_limited' returning id into result_id;
 if result_id is null then raise exception 'Invitation reservation changed'; end if;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'bulk_player_invite_reserved',jsonb_build_object('count',1));
 return jsonb_build_object('claimed',true,'id',result_id);
end;
$$;

create function private.mark_player_invite_rejected(p_attempt uuid,p_athlete uuid,p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if exists(select 1 from public.account_athletes where athlete_id=p_athlete) then raise exception 'Player already connected'; end if;
 if exists(select 1 from private.player_invite_attempts where id=p_attempt and athlete_id=p_athlete and email=p_email and status='attempted' and actor_id is distinct from auth.uid()) then raise exception 'Invitation started by another administrator' using errcode='42501'; end if;
 update private.player_invite_attempts set status='rate_limited' where id=p_attempt and athlete_id=p_athlete and email=p_email and actor_id=auth.uid() and status='attempted';
 if not found then raise exception 'No matching pending invitation'; end if;
 insert into public.audit_events(actor_id,event_type,details) values(auth.uid(),'bulk_player_invite_rejected',jsonb_build_object('count',1));
end;
$$;
create function public.admin_mark_player_invite_rejected(p_attempt uuid,p_athlete uuid,p_email text) returns void language sql security invoker set search_path='' as $$select private.mark_player_invite_rejected(p_attempt,p_athlete,p_email);$$;
revoke all on function private.mark_player_invite_rejected(uuid,uuid,text),public.admin_mark_player_invite_rejected(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.mark_player_invite_rejected(uuid,uuid,text),public.admin_mark_player_invite_rejected(uuid,uuid,text) to authenticated;
create or replace function private.player_invite_history() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'athlete_id',athlete_id,'status',status) order by created_at),'[]'::jsonb) from private.player_invite_attempts);
end;
$$;
commit;
