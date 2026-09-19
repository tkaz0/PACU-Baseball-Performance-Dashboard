-- Reversible removal of one athlete's mistaken Full Swing file assignment.
create table private.csv_measurement_archives (
 request_id uuid primary key, athlete_id uuid not null references public.athletes(id),
 file_hash text not null, fingerprint text not null, source_file text not null,
 observations jsonb not null check(jsonb_array_length(observations) between 1 and 500),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 restored_at timestamptz, restored_by uuid references auth.users(id)
);
alter table private.csv_measurement_archives enable row level security;
revoke all on private.csv_measurement_archives from public,anon,authenticated;
create index csv_archive_file on private.csv_measurement_archives(file_hash) where restored_at is null;

create function private.csv_measurement_batches(p_athlete uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare active_rows jsonb; archived_rows jsonb;
begin
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x.item order by x.hash),'[]'::jsonb) into active_rows from (
  select m.file_hash hash, jsonb_build_object('fileHash',m.file_hash,'sourceFile',min(m.source_file),
   'count',count(*),'firstDate',min(m.measured_at),'lastDate',max(m.measured_at),
   'fingerprint',md5(jsonb_agg(to_jsonb(m) order by m.id)::text)) item
  from public.performance_measurements m where m.athlete_id=p_athlete and m.source ~* '^Full Swing( · |$)' group by m.file_hash
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',a.request_id,'fileHash',a.file_hash,
  'sourceFile',a.source_file,'count',jsonb_array_length(a.observations),'fingerprint',a.fingerprint,
  'removedAt',a.created_at,'restored',a.restored_at is not null) order by a.created_at desc),'[]'::jsonb)
 into archived_rows from private.csv_measurement_archives a where a.athlete_id=p_athlete;
 if jsonb_array_length(active_rows)>100 or jsonb_array_length(archived_rows)>100 then raise exception 'Too many files; contact the administrator'; end if;
 return jsonb_build_object('active',active_rows,'archived',archived_rows);
end $$;

create function private.set_csv_measurement_archive(p_request_id uuid,p_athlete uuid,p_file_hash text,p_fingerprint text,p_restore boolean,p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.csv_measurement_archives; saved jsonb; total integer; changed integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(72104001);
 perform pg_catalog.pg_advisory_xact_lock(72104002);
 if not private.has_role('admin') then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_reviewed is distinct from true or p_request_id is null or p_athlete is null or p_restore is null
  or p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{32}$'
 then raise exception 'Review the exact CSV assignment' using errcode='22023'; end if;
 select * into prior from private.csv_measurement_archives where request_id=p_request_id for update;
 if prior.request_id is not null then
  if prior.athlete_id<>p_athlete or prior.file_hash<>p_file_hash or prior.fingerprint<>p_fingerprint
   then raise exception 'Removal request already used' using errcode='23505'; end if;
  total:=jsonb_array_length(prior.observations);
  if p_restore and prior.restored_at is null then
   -- Clear the import guard only inside this atomic restore; conflicts roll back everything.
   update private.csv_measurement_archives set restored_at=now(),restored_by=auth.uid() where request_id=p_request_id;
   insert into public.performance_measurements select * from jsonb_populate_recordset(null::public.performance_measurements,prior.observations);
   insert into public.audit_events(actor_id,event_type,target_id,details)
    values(auth.uid(),'csv_measurements_restored',p_request_id,jsonb_build_object('count',total));
  end if;
 else
  if p_restore then raise exception 'Removal not found' using errcode='22023'; end if;
  select jsonb_agg(to_jsonb(m) order by m.id) into saved from public.performance_measurements m
   where m.athlete_id=p_athlete and m.file_hash=p_file_hash and m.source ~* '^Full Swing( · |$)';
  total:=coalesce(jsonb_array_length(saved),0);
  if total not between 1 and 500 or md5(saved::text)<>p_fingerprint
   then raise exception 'CSV readings changed; refresh and review again' using errcode='40001'; end if;
  insert into private.csv_measurement_archives(request_id,athlete_id,file_hash,fingerprint,source_file,observations,actor_id)
   values(p_request_id,p_athlete,p_file_hash,p_fingerprint,saved->0->>'source_file',saved,auth.uid());
  delete from public.performance_measurements m where m.id in (select (j->>'id')::uuid from jsonb_array_elements(saved) j);
  get diagnostics changed = row_count;
  if changed<>total then raise exception 'CSV readings changed' using errcode='40001'; end if;
  insert into public.audit_events(actor_id,event_type,target_id,details)
   values(auth.uid(),'csv_measurements_removed',p_request_id,jsonb_build_object('count',total));
 end if;
 return jsonb_build_object('requestId',p_request_id,'count',total,'restored',p_restore or prior.restored_at is not null);
end $$;

-- A retry/re-upload cannot silently recreate a removed mistaken source coordinate.
create function private.guard_removed_csv_observation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.csv_measurement_archives a cross join lateral jsonb_array_elements(a.observations) o
  where a.file_hash=new.file_hash and a.restored_at is null and
  (o->>'observation_id'=new.observation_id or (o->>'source_sheet'=new.source_sheet and
    (o->>'source_row')::integer=new.source_row and (o->>'source_column')::integer=new.source_column)))
 then raise exception 'These CSV readings were removed; skip this export player or review the saved removal' using errcode='23505'; end if;
 return new;
end $$;
create trigger guard_removed_csv_observation before insert on public.performance_measurements for each row execute function private.guard_removed_csv_observation();
revoke all on function private.guard_removed_csv_observation() from public,anon,authenticated;

create function public.admin_csv_measurement_batches(p_athlete uuid) returns jsonb language sql security invoker set search_path='' as $$select private.csv_measurement_batches(p_athlete)$$;
create function public.admin_set_csv_measurement_archive(p_request_id uuid,p_athlete uuid,p_file_hash text,p_fingerprint text,p_restore boolean,p_reviewed boolean default false)
returns jsonb language sql security invoker set search_path='' as $$select private.set_csv_measurement_archive(p_request_id,p_athlete,p_file_hash,p_fingerprint,p_restore,p_reviewed)$$;
revoke all on function private.csv_measurement_batches(uuid),public.admin_csv_measurement_batches(uuid),
 private.set_csv_measurement_archive(uuid,uuid,text,text,boolean,boolean),public.admin_set_csv_measurement_archive(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function private.csv_measurement_batches(uuid),public.admin_csv_measurement_batches(uuid),
 private.set_csv_measurement_archive(uuid,uuid,text,text,boolean,boolean),public.admin_set_csv_measurement_archive(uuid,uuid,text,text,boolean,boolean) to authenticated;
