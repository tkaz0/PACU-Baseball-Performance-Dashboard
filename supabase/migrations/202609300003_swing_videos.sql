begin;
-- Files live in a private bucket. Metadata never grants access independently of
-- the current source contact and ordinary, live own-athlete/staff authorization.
create table public.swing_videos (
  id uuid primary key,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
  source_row integer not null check(source_row between 2 and 1000000),
  title text not null check(length(title) between 1 and 80 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  object_path text not null unique,
  mime_type text not null check(mime_type in ('video/mp4','video/webm','video/quicktime')),
  byte_size bigint not null check(byte_size between 1 and 52428800),
  status text not null default 'pending' check(status in ('pending','ready','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz
);
create index swing_videos_athlete on public.swing_videos(athlete_id,status,file_hash,source_row);
alter table public.swing_videos enable row level security;
revoke all on public.swing_videos from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('swing-videos','swing-videos',false,52428800,array['video/mp4','video/webm','video/quicktime']);

create function private.swing_video_can_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.swing_videos v join public.full_swing_contacts c
    on c.file_hash=v.file_hash and c.source_row=v.source_row and c.athlete_id=v.athlete_id
    where v.object_path=p_path and v.status='ready' and private.can_read_athlete(v.athlete_id));
$$;
create function private.swing_video_can_upload(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select (private.has_role('admin') or private.has_role('coach')) and exists(
    select 1 from public.swing_videos v join public.full_swing_contacts c
    on c.file_hash=v.file_hash and c.source_row=v.source_row and c.athlete_id=v.athlete_id
    where v.object_path=p_path and v.status='pending' and v.created_by=auth.uid() and v.created_at>now()-interval '24 hours');
$$;
create policy swing_video_private_read on storage.objects for select to authenticated
using(bucket_id='swing-videos' and private.swing_video_can_read(name));
create policy swing_video_reserved_upload on storage.objects for insert to authenticated
with check(bucket_id='swing-videos' and private.swing_video_can_upload(name));
-- No update/delete policy: a signed upload cannot overwrite an existing clip.
-- Restrictive bucket guards keep any other bucket's broad policies from widening access.
create policy swing_video_read_guard on storage.objects as restrictive for select to authenticated
using(bucket_id<>'swing-videos' or private.swing_video_can_read(name));
create policy swing_video_upload_guard on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'swing-videos' or private.swing_video_can_upload(name));
create policy swing_video_no_overwrite on storage.objects as restrictive for update to public
using(bucket_id<>'swing-videos') with check(bucket_id<>'swing-videos');
create policy swing_video_no_delete on storage.objects as restrictive for delete to public
using(bucket_id<>'swing-videos');
create policy swing_video_no_anonymous on storage.objects as restrictive for all to anon
using(bucket_id<>'swing-videos') with check(bucket_id<>'swing-videos');

create function private.read_swing_videos(p_athlete_id uuid,p_video_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Swing video access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'fileHash',v.file_hash,'sourceRow',v.source_row,'title',v.title,'bytes',v.byte_size,'createdAt',v.created_at)
    || case when p_video_id is not null then jsonb_build_object('objectPath',v.object_path) else '{}'::jsonb end order by v.created_at,v.id),'[]'::jsonb) into result
  from public.swing_videos v join public.full_swing_contacts c on c.file_hash=v.file_hash and c.source_row=v.source_row and c.athlete_id=v.athlete_id
  where v.athlete_id=p_athlete_id and v.status='ready' and (p_video_id is null or v.id=p_video_id);
  if jsonb_array_length(result)>500 then raise exception 'Swing video limit exceeded'; end if;
  return result;
end;
$$;
create function public.athlete_swing_videos(p_athlete_id uuid,p_video_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.read_swing_videos(p_athlete_id,p_video_id); $$;

create function private.reserve_swing_video(p_id uuid,p_athlete_id uuid,p_file_hash text,p_source_row integer,p_title text,p_mime_type text,p_bytes bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.swing_videos; extension text; path text;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001); perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  if p_id is null or p_athlete_id is null or p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$' or p_source_row is null or p_source_row not between 2 and 1000000
    or p_title is null or length(p_title) not between 1 and 80 or p_title<>btrim(p_title) or p_title ~ '[[:cntrl:]]'
    or p_mime_type is null or p_mime_type not in ('video/mp4','video/webm','video/quicktime') or p_bytes is null or p_bytes not between 1 and 52428800 then raise exception 'Invalid swing video' using errcode='22023'; end if;
  if not exists(select 1 from public.full_swing_contacts where file_hash=p_file_hash and source_row=p_source_row and athlete_id=p_athlete_id) then raise exception 'Swing no longer available' using errcode='40001'; end if;
  select * into prior from public.swing_videos where id=p_id for update;
  if prior.id is not null then
    if prior.athlete_id<>p_athlete_id or prior.file_hash<>p_file_hash or prior.source_row<>p_source_row or prior.title<>p_title or prior.mime_type<>p_mime_type or prior.byte_size<>p_bytes or prior.created_by<>auth.uid() or prior.status='archived'
      or (prior.status='pending' and prior.created_at<=now()-interval '24 hours') then raise exception 'Upload changed; start a new review' using errcode='40001'; end if;
    return jsonb_build_object('id',prior.id,'path',prior.object_path,'status',prior.status);
  end if;
  if (select count(*) from public.swing_videos where athlete_id=p_athlete_id and (status='ready' or (status='pending' and created_at>now()-interval '24 hours')))>=500
    or (select count(*) from public.swing_videos where athlete_id=p_athlete_id and file_hash=p_file_hash and source_row=p_source_row and (status='ready' or (status='pending' and created_at>now()-interval '24 hours')))>=4 then raise exception 'Swing video limit reached' using errcode='22023'; end if;
  extension:=case p_mime_type when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' else 'mov' end;
  path:=p_athlete_id::text||'/'||p_id::text||'.'||extension;
  insert into public.swing_videos(id,athlete_id,file_hash,source_row,title,object_path,mime_type,byte_size,created_by)
    values(p_id,p_athlete_id,p_file_hash,p_source_row,p_title,path,p_mime_type,p_bytes,auth.uid());
  return jsonb_build_object('id',p_id,'path',path,'status','pending');
end;
$$;
create function public.staff_reserve_swing_video(p_id uuid,p_athlete_id uuid,p_file_hash text,p_source_row integer,p_title text,p_mime_type text,p_bytes bigint) returns jsonb
language sql security invoker set search_path='' as $$select private.reserve_swing_video(p_id,p_athlete_id,p_file_hash,p_source_row,p_title,p_mime_type,p_bytes);$$;

create function private.finish_swing_video(p_id uuid,p_athlete_id uuid,p_archive boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.swing_videos; object_metadata jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001); perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not(private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  if p_id is null or p_athlete_id is null or p_archive is null then raise exception 'Invalid video'; end if;
  select * into v from public.swing_videos where id=p_id and athlete_id=p_athlete_id for update;
  if v.id is null then raise exception 'Video not found' using errcode='22023'; end if;
  if p_archive then
    if v.status='archived' then return jsonb_build_object('id',v.id,'status','archived'); end if;
    update public.swing_videos set status='archived',archived_at=coalesce(archived_at,now()) where id=v.id;
    insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'swing_video_detached',v.athlete_id,jsonb_build_object('video_id',v.id));
    return jsonb_build_object('id',v.id,'status','archived');
  end if;
  if v.status='archived' or not exists(select 1 from public.full_swing_contacts where file_hash=v.file_hash and source_row=v.source_row and athlete_id=v.athlete_id) then raise exception 'Swing no longer available' using errcode='40001'; end if;
  if v.status='ready' then return jsonb_build_object('id',v.id,'status','ready'); end if;
  if v.created_by<>auth.uid() or v.created_at<=now()-interval '24 hours' then raise exception 'Upload expired' using errcode='40001'; end if;
  select metadata into object_metadata from storage.objects where bucket_id='swing-videos' and name=v.object_path;
  if object_metadata is null or object_metadata->>'size' is distinct from v.byte_size::text or object_metadata->>'mimetype' is distinct from v.mime_type then raise exception 'Uploaded video is not ready' using errcode='22023'; end if;
  update public.swing_videos set status='ready',published_at=now() where id=v.id;
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'swing_video_attached',v.athlete_id,jsonb_build_object('video_id',v.id));
  return jsonb_build_object('id',v.id,'status','ready');
end;
$$;
create function public.staff_finish_swing_video(p_id uuid,p_athlete_id uuid,p_archive boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.finish_swing_video(p_id,p_athlete_id,p_archive);$$;
revoke all on function private.swing_video_can_read(text),private.swing_video_can_upload(text),private.read_swing_videos(uuid,uuid),public.athlete_swing_videos(uuid,uuid),
 private.reserve_swing_video(uuid,uuid,text,integer,text,text,bigint),public.staff_reserve_swing_video(uuid,uuid,text,integer,text,text,bigint),private.finish_swing_video(uuid,uuid,boolean),public.staff_finish_swing_video(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.swing_video_can_read(text),private.swing_video_can_upload(text),private.read_swing_videos(uuid,uuid),public.athlete_swing_videos(uuid,uuid),
 private.reserve_swing_video(uuid,uuid,text,integer,text,text,bigint),public.staff_reserve_swing_video(uuid,uuid,text,integer,text,text,bigint),private.finish_swing_video(uuid,uuid,boolean),public.staff_finish_swing_video(uuid,uuid,boolean) to authenticated;
commit;
