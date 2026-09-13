-- Reviewed dated game entries remain separate from cumulative sheet snapshots.
create table public.game_logs (
 id uuid primary key, athlete_id uuid not null references public.athletes(id) on delete restrict,
 played_on date not null check(played_on between '2026-09-01' and '2026-12-31'), opponent text not null check(length(opponent) between 1 and 80),
 game_number integer not null check(game_number between 1 and 3), kind text not null check(kind in ('game','intrasquad')),
 batting jsonb not null, pitching jsonb not null, version integer not null check(version>0), updated_at timestamptz not null default now()
);
create unique index game_logs_identity on public.game_logs(athlete_id,played_on,lower(opponent),game_number,kind);
create table private.game_log_receipts(request_id uuid primary key, actor_id uuid not null references auth.users(id), payload jsonb not null, previous_record jsonb, receipt jsonb not null, created_at timestamptz not null default now());
alter table public.game_logs enable row level security;
alter table private.game_log_receipts enable row level security;
create policy game_logs_read on public.game_logs for select to authenticated using(private.can_read_athlete(athlete_id));
revoke all on public.game_logs from public,anon,authenticated;
grant select on public.game_logs to authenticated;
revoke all on private.game_log_receipts from public,anon,authenticated;
create function private.save_game_log(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; p jsonb; k text; n jsonb; existing public.game_logs%rowtype; saved private.game_log_receipts%rowtype; result jsonb; rid uuid; aid uuid; request uuid; expected integer; d date; opponent_name text;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active import staff required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if jsonb_typeof(p_input) is distinct from 'object' or (select string_agg(key,',' order by key) from jsonb_object_keys(p_input) key) <> 'athleteId,batting,expectedVersion,gameNumber,id,kind,opponent,pitching,playedOn,requestId' then raise exception 'Invalid game entry'; end if;
 if (select count(*) from jsonb_each(p_input) where key in ('requestId','id','athleteId','playedOn','opponent','kind') and jsonb_typeof(value)='string')<>6 then raise exception 'Invalid game entry fields'; end if;
 rid=(p_input->>'id')::uuid; aid=(p_input->>'athleteId')::uuid; request=(p_input->>'requestId')::uuid;
 if rid is null or aid is null or request is null or jsonb_typeof(p_input->'expectedVersion')<>'number' or (p_input->>'expectedVersion') !~ '^[0-9]+$' or (p_input->>'expectedVersion')::numeric>1000000 then raise exception 'Invalid game version'; end if;
 expected=(p_input->>'expectedVersion')::integer;
 if jsonb_typeof(p_input->'gameNumber')<>'number' or (p_input->>'gameNumber')!~ '^[1-3]$' or p_input->>'kind' not in ('game','intrasquad') then raise exception 'Invalid game number or type'; end if;
 if (p_input->>'playedOn')!~ '^2026-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid game date'; end if;
 d=(p_input->>'playedOn')::date;
 if d<'2026-09-01' or d>'2026-12-31' or d>(now() at time zone 'America/Los_Angeles')::date then raise exception 'Use an actual Fall game date'; end if;
 opponent_name=regexp_replace(btrim(p_input->>'opponent'),'\s+',' ','g');
 if opponent_name is null or length(opponent_name) not between 1 and 80 or (p_input->>'opponent') ~ '[[:cntrl:]]' or opponent_name<>p_input->>'opponent' then raise exception 'Review the opponent name'; end if;
 if not exists(select 1 from public.athlete_seasons where athlete_id=aid and season='2026-27' and (roster_status is null or roster_status in ('active','redshirt'))) then raise exception 'Choose an eligible player'; end if;
 b=p_input->'batting'; p=p_input->'pitching';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(p) is distinct from 'object' or (b='{}' and p='{}') then raise exception 'Enter recorded game counts'; end if;
 for k,n in select key,value from jsonb_each(b) loop
  if k not in ('pa','ab','h','doubles','triples','hr','bb','hbp','sf','sh','k','sb','gdp','rbi') or jsonb_typeof(n)<>'number' or n::text !~ '^[0-9]+$' or n::numeric>1000 then raise exception 'Invalid batting count'; end if;
 end loop;
 for k,n in select key,value from jsonb_each(p) loop
  if k not in ('pitches','strikes','bf','k','bb','h','r','er','outs') or jsonb_typeof(n)<>'number' or n::text !~ '^[0-9]+$' or n::numeric>1000 then raise exception 'Invalid pitching count'; end if;
 end loop;
 if (b->>'h')::int+(b->>'k')::int>(b->>'ab')::int or (b->>'bb')::int>(b->>'pa')::int or (b->>'hbp')::int>(b->>'pa')::int or (b->>'sf')::int>(b->>'pa')::int or (b->>'sh')::int>(b->>'pa')::int or (b->>'ab')::int>(b->>'pa')::int or (b->>'h')::int>(b->>'ab')::int or (b->>'k')::int>(b->>'ab')::int or (b->>'hr')::int>(b->>'h')::int or (b->>'doubles')::int>(b->>'h')::int or (b->>'triples')::int>(b->>'h')::int or (b->>'doubles')::int+(b->>'triples')::int+(b->>'hr')::int>(b->>'h')::int or (b->>'ab')::int+(b->>'bb')::int+(b->>'hbp')::int+(b->>'sf')::int>(b->>'pa')::int or (b->>'ab')::int+(b->>'bb')::int+(b->>'hbp')::int+(b->>'sf')::int+(b->>'sh')::int>(b->>'pa')::int then raise exception 'Batting counts conflict'; end if;
 if (p->>'strikes')::int>(p->>'pitches')::int or (p->>'er')::int>(p->>'r')::int or (p->>'k')::int>(p->>'bf')::int or (p->>'bb')::int>(p->>'bf')::int or (p->>'h')::int>(p->>'bf')::int or (p->>'k')::int+(p->>'bb')::int+(p->>'h')::int>(p->>'bf')::int then raise exception 'Pitching counts conflict'; end if;
 select * into saved from private.game_log_receipts where request_id=request;
 if found then
  if saved.actor_id<>auth.uid() or saved.payload<>p_input then raise exception 'Request was already used differently' using errcode='40001'; end if;
  return saved.receipt;
 end if;
 select * into existing from public.game_logs where id=rid for update;
 if found then
  if existing.version<>expected or existing.athlete_id<>aid then raise exception 'Game entry changed. Refresh before editing' using errcode='40001'; end if;
 elsif expected<>0 then raise exception 'Game entry changed. Refresh before editing' using errcode='40001'; end if;
 insert into public.game_logs(id,athlete_id,played_on,opponent,game_number,kind,batting,pitching,version) values(rid,aid,d,opponent_name,(p_input->>'gameNumber')::int,p_input->>'kind',b,p,expected+1)
 on conflict(id) do update set played_on=excluded.played_on,opponent=excluded.opponent,game_number=excluded.game_number,kind=excluded.kind,batting=excluded.batting,pitching=excluded.pitching,version=excluded.version,updated_at=now();
 result=jsonb_build_object('status','saved','id',rid,'version',expected+1);
 insert into private.game_log_receipts(request_id,actor_id,payload,previous_record,receipt) values(request,auth.uid(),p_input,case when existing.id is not null then to_jsonb(existing) else null end,result);
 insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'game_log_saved',rid,jsonb_build_object('version',expected+1,'request_id',request));
 return result;
end $$;
create function public.save_game_log(p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.save_game_log(p_input)$$;
create function public.read_game_logs(p_athlete_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_athlete_id is null then
  if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Select your linked athlete' using errcode='42501'; end if;
 elsif not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'athleteId',athlete_id,'playedOn',played_on,'opponent',opponent,'gameNumber',game_number,'kind',kind,'batting',batting,'pitching',pitching,'version',version,'updatedAt',updated_at) order by played_on desc,game_number desc,id),'[]') into result from public.game_logs where p_athlete_id is null or athlete_id=p_athlete_id;
 if jsonb_array_length(result)>20000 then raise exception 'Game log limit exceeded'; end if;
 return result;
end $$;
revoke all on function private.save_game_log(jsonb),public.save_game_log(jsonb),public.read_game_logs(uuid) from public,anon,authenticated;
grant execute on function private.save_game_log(jsonb),public.save_game_log(jsonb),public.read_game_logs(uuid) to authenticated;
