begin;

-- Immutable, deliberately saved staff snapshots. No source files or automatic meetings.
create function private.exit_meeting_text(v jsonb, maximum integer, allow_empty boolean default false)
returns boolean language sql immutable set search_path='' as $$
 -- Match JavaScript's UTF-16 string limit, including two units for supplementary characters.
 select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')+length(regexp_replace(v#>>'{}','[^'||chr(65536)||'-'||chr(1114111)||']','','g'))<=maximum and
   (allow_empty or length(v#>>'{}')>0) and
   translate(v#>>'{}',chr(9)||chr(10)||chr(13),'') !~ '[[:cntrl:]]' and
   (v#>>'{}') !~ ('['||chr(8234)||'-'||chr(8238)||chr(8294)||'-'||chr(8297)||']'),false);
$$;
create function private.exit_meeting_date(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'string' or (v#>>'{}') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then return false; end if;
 return isfinite((v#>>'{}')::date) and to_char((v#>>'{}')::date,'YYYY-MM-DD')=(v#>>'{}');
exception when others then return false;
end;
$$;
create function private.exit_meeting_stamp(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>40 or
 (v#>>'{}') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-](0[0-9]|1[0-4]):[0-5][0-9])$' then return false; end if;
 return private.exit_meeting_date(to_jsonb(left(v#>>'{}',10))) and isfinite((v#>>'{}')::timestamptz);
exception when others then return false;
end;
$$;
create function private.valid_exit_meeting_report(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare allowed text[]:=array['format','name','code','jersey','position','academicClass','batsThrows','season','generatedAt','lastTested','lastGameUpdate','strengths','development','jumps','sections','missing','notes'];
 item jsonb; section jsonb; r jsonb; point jsonb; k text; total integer:=0; ids text[]:='{}';
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>262144 or not (p ?& allowed) or p-allowed<>'{}'::jsonb or (p->>'format') is distinct from 'meeting' or (p->>'season') is distinct from 'Fall 2026' then return false; end if;
 if not private.exit_meeting_text(p->'name',220) or not private.exit_meeting_text(p->'code',40) or p->>'code' !~ '^PAC-[0-9]{4,}$' then return false; end if;
 foreach k in array array['jersey','position','academicClass','batsThrows'] loop if not private.exit_meeting_text(p->k,160,true) then return false; end if; end loop;
 if private.exit_meeting_stamp(p->'generatedAt') is not true then return false; end if;
 if p->'lastTested'<>'null'::jsonb and private.exit_meeting_date(p->'lastTested') is not true then return false; end if;
 if p->'lastGameUpdate'<>'null'::jsonb and private.exit_meeting_stamp(p->'lastGameUpdate') is not true then return false; end if;
 foreach k in array array['strengths','development','jumps'] loop
  if jsonb_typeof(p->k)<>'array' or jsonb_array_length(p->k)>2 then return false; end if;
  for item in select value from jsonb_array_elements(p->k) loop
   if jsonb_typeof(item)<>'object' or not (item ?& array['label','detail','percentile']) or item-array['label','detail','percentile']<>'{}'::jsonb or not private.exit_meeting_text(item->'label',180) or not private.exit_meeting_text(item->'detail',1200) then return false; end if;
   if item->'percentile'<>'null'::jsonb and (jsonb_typeof(item->'percentile')<>'number' or (item->>'percentile')::numeric not between 0 and 100) then return false; end if;
  end loop;
 end loop;
 foreach k in array array['missing','notes'] loop
  if jsonb_typeof(p->k)<>'array' or jsonb_array_length(p->k)>20 then return false; end if;
  for item in select value from jsonb_array_elements(p->k) loop if not private.exit_meeting_text(item,case when k='missing' then 500 else 2000 end) then return false; end if; end loop;
 end loop;
 if jsonb_typeof(p->'sections')<>'array' or jsonb_array_length(p->'sections')>24 then return false; end if;
 for section in select value from jsonb_array_elements(p->'sections') loop
  if jsonb_typeof(section)<>'object' or not (section ?& array['id','title','subtitle','rows']) or section-array['id','title','subtitle','rows','note']<>'{}'::jsonb or not private.exit_meeting_text(section->'id',100) or (section->>'id')=any(ids) or not private.exit_meeting_text(section->'title',180) or not private.exit_meeting_text(section->'subtitle',1000) or (section?'note' and not private.exit_meeting_text(section->'note',2000)) or jsonb_typeof(section->'rows')<>'array' or jsonb_array_length(section->'rows')>150 then return false; end if;
  ids:=array_append(ids,section->>'id');total:=total+jsonb_array_length(section->'rows');
  for r in select value from jsonb_array_elements(section->'rows') loop
   if jsonb_typeof(r)<>'object' or not (r ?& array['label','value','source','date','basis','percentile','peers','sample']) or r-array['label','value','source','date','basis','percentile','peers','sample','metricKey','tone','trend']<>'{}'::jsonb or not private.exit_meeting_text(r->'label',200) or not private.exit_meeting_text(r->'value',250) or not private.exit_meeting_text(r->'source',160) or not private.exit_meeting_text(r->'date',80) or not private.exit_meeting_text(r->'basis',350) or (r->'sample'<>'null'::jsonb and not private.exit_meeting_text(r->'sample',250)) then return false; end if;
   if r->'peers'<>'null'::jsonb and (jsonb_typeof(r->'peers')<>'number' or (r->>'peers')::numeric not between 1 and 1000 or trunc((r->>'peers')::numeric)<>(r->>'peers')::numeric) then return false; end if;
   if r->'percentile'<>'null'::jsonb and (jsonb_typeof(r->'percentile')<>'number' or (r->>'percentile')::numeric not between 0 and 100 or r->'peers'='null'::jsonb or (r->>'peers')::numeric<5) then return false; end if;
   if (r?'metricKey' and (not private.exit_meeting_text(r->'metricKey',100) or r->>'metricKey' !~ '^[a-z0-9_]+$')) or (r?'tone' and (jsonb_typeof(r->'tone') is distinct from 'string' or not coalesce(r->>'tone' in ('none','green','yellow','red'),false))) then return false; end if;
   if r?'trend' then
    if jsonb_typeof(r->'trend')<>'array' or jsonb_array_length(r->'trend')>8 then return false; end if;
    for point in select value from jsonb_array_elements(r->'trend') loop
     if jsonb_typeof(point)<>'object' or not(point ?& array['date','value']) or point-array['date','value']<>'{}'::jsonb or private.exit_meeting_date(point->'date') is not true or jsonb_typeof(point->'value')<>'number' or (point->>'value')::numeric not between -1000000000 and 1000000000 then return false; end if;
    end loop;
   end if;
  end loop;
 end loop;
 return total<=300;
exception when others then return false;
end;
$$;

create table public.exit_meeting_snapshots (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athletes(id) on delete restrict,
 request_id uuid not null,
 meeting_date date not null check(meeting_date between date '2000-01-01' and date '2099-12-31'),
 talking_points text not null default '' check(length(talking_points)<=1600 and talking_points=btrim(talking_points) and private.exit_meeting_text(to_jsonb(talking_points),1600,true)),
 report jsonb not null check(private.valid_exit_meeting_report(report)),
 schema_version integer not null default 1 check(schema_version=1),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(created_by,request_id)
);
create function private.exit_meeting_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Saved meeting snapshots cannot be changed or deleted' using errcode='42501'; end;
$$;
create trigger exit_meeting_snapshot_immutable before update or delete on public.exit_meeting_snapshots for each row execute function private.exit_meeting_immutable();
create index exit_meeting_athlete_history_idx on public.exit_meeting_snapshots(athlete_id,created_at desc,id desc);
alter table public.exit_meeting_snapshots enable row level security;
revoke all on public.exit_meeting_snapshots from public,anon,authenticated;

create function private.exit_meeting_snapshot_json(s public.exit_meeting_snapshots,include_report boolean) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'athleteId',s.athlete_id,'meetingDate',s.meeting_date,'createdAt',s.created_at,
  'generatedAt',s.report->>'generatedAt','metricCount',(select coalesce(sum(jsonb_array_length(section->'rows')),0) from jsonb_array_elements(s.report->'sections') section),
  'hasNotes',length(s.talking_points)>0,'schemaVersion',s.schema_version)
  ||case when include_report then jsonb_build_object('report',s.report,'talkingPoints',s.talking_points) else '{}'::jsonb end;
$$;
create function private.read_exit_meeting_history(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
 if p_athlete_id is null or not exists(select 1 from public.athletes where id=p_athlete_id) then raise exception 'Unknown athlete'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(private.exit_meeting_snapshot_json(s,false) order by s.created_at desc,s.id desc) from (select * from public.exit_meeting_snapshots where athlete_id=p_athlete_id order by created_at desc,id desc limit 50) s),'[]'::jsonb),'hasMore',(select count(*)>50 from public.exit_meeting_snapshots where athlete_id=p_athlete_id));
end;
$$;
create function private.read_exit_meeting_snapshot(p_athlete_id uuid,p_snapshot_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
 return (select private.exit_meeting_snapshot_json(s,true) from public.exit_meeting_snapshots s where s.id=p_snapshot_id and s.athlete_id=p_athlete_id);
end;
$$;
create function private.read_exit_meeting_attempt(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
 return (select private.exit_meeting_snapshot_json(s,true) from public.exit_meeting_snapshots s where s.request_id=p_request_id and s.created_by=auth.uid());
end;
$$;
create function private.save_exit_meeting_snapshot(p_request_id uuid,p_athlete_id uuid,p_meeting_date date,p_talking_points text,p_report jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.exit_meeting_snapshots; saved public.exit_meeting_snapshots; code text;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
 if p_request_id is null or p_athlete_id is null or p_meeting_date is null or p_talking_points is null then raise exception 'Invalid meeting request'; end if;
 select * into existing from public.exit_meeting_snapshots where request_id=p_request_id and created_by=auth.uid();
 if existing.id is not null then
  if existing.athlete_id<>p_athlete_id or existing.meeting_date<>p_meeting_date or existing.talking_points<>p_talking_points then raise exception 'Meeting request already used with different options' using errcode='22023'; end if;
  return private.exit_meeting_snapshot_json(existing,true);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 select athlete_code into code from public.athletes where id=p_athlete_id for share;
 if code is null or not exists(select 1 from public.athlete_seasons where athlete_id=p_athlete_id and season='2026-27') then raise exception 'Unknown current roster athlete'; end if;
 if private.valid_exit_meeting_report(p_report) is not true or p_report->>'code'<>code or (p_report->>'generatedAt')::timestamptz<clock_timestamp()-interval '15 minutes' or (p_report->>'generatedAt')::timestamptz>clock_timestamp()+interval '1 minute' then raise exception 'Invalid or stale meeting report'; end if;
 if (select count(*) from public.exit_meeting_snapshots where athlete_id=p_athlete_id)>=500 then raise exception 'Meeting history limit reached'; end if;
 insert into public.exit_meeting_snapshots(athlete_id,request_id,meeting_date,talking_points,report,created_by)
 values(p_athlete_id,p_request_id,p_meeting_date,p_talking_points,p_report,auth.uid()) returning * into saved;
 insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'exit_meeting_saved',p_athlete_id,jsonb_build_object('snapshot_id',saved.id,'schema_version',1));
 return private.exit_meeting_snapshot_json(saved,true);
end;
$$;
create function public.staff_exit_meeting_history(p_athlete_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_exit_meeting_history(p_athlete_id); $$;
create function public.staff_exit_meeting_snapshot(p_athlete_id uuid,p_snapshot_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_exit_meeting_snapshot(p_athlete_id,p_snapshot_id); $$;
create function public.staff_exit_meeting_attempt(p_request_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_exit_meeting_attempt(p_request_id); $$;
create function public.staff_save_exit_meeting_snapshot(p_request_id uuid,p_athlete_id uuid,p_meeting_date date,p_talking_points text,p_report jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.save_exit_meeting_snapshot(p_request_id,p_athlete_id,p_meeting_date,p_talking_points,p_report); $$;
revoke all on function private.exit_meeting_text(jsonb,integer,boolean),private.exit_meeting_date(jsonb),private.exit_meeting_stamp(jsonb),private.valid_exit_meeting_report(jsonb),private.exit_meeting_immutable(),private.exit_meeting_snapshot_json(public.exit_meeting_snapshots,boolean) from public,anon,authenticated;
revoke all on function private.read_exit_meeting_history(uuid),private.read_exit_meeting_snapshot(uuid,uuid),private.read_exit_meeting_attempt(uuid),private.save_exit_meeting_snapshot(uuid,uuid,date,text,jsonb),public.staff_exit_meeting_history(uuid),public.staff_exit_meeting_snapshot(uuid,uuid),public.staff_exit_meeting_attempt(uuid),public.staff_save_exit_meeting_snapshot(uuid,uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function private.read_exit_meeting_history(uuid),private.read_exit_meeting_snapshot(uuid,uuid),private.read_exit_meeting_attempt(uuid),private.save_exit_meeting_snapshot(uuid,uuid,date,text,jsonb),public.staff_exit_meeting_history(uuid),public.staff_exit_meeting_snapshot(uuid,uuid),public.staff_exit_meeting_attempt(uuid),public.staff_save_exit_meeting_snapshot(uuid,uuid,date,text,jsonb) to authenticated;
commit;
