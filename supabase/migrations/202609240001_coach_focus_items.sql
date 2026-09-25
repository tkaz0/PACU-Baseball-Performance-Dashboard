begin;

create table public.coach_focus_items (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  title text not null check (length(title) between 1 and 120 and title = btrim(title) and title !~ '[[:cntrl:]]'),
  staff_note text check (length(staff_note) <= 600 and staff_note !~ '[[:cntrl:]]'),
  target_date date,
  shared_with_player boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_focus_athlete_idx on public.coach_focus_items(athlete_id,completed_at,created_at desc);
alter table public.coach_focus_items enable row level security;
revoke all on public.coach_focus_items from public,anon,authenticated;

create function private.read_coach_focus_items(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare staff boolean;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then
    raise exception 'Athlete access denied' using errcode = '42501';
  end if;
  staff := private.has_role('admin') or private.has_role('coach');
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',f.id,'athleteId',f.athlete_id,'title',f.title,
    'staffNote',case when staff then f.staff_note else null end,
    'targetDate',f.target_date,'shared',f.shared_with_player,
    'completedAt',f.completed_at,'createdAt',f.created_at
  ) order by (f.completed_at is not null),f.created_at desc,f.id)
  from public.coach_focus_items f
  where f.athlete_id=p_athlete_id and (staff or (f.shared_with_player and f.completed_at is null))), '[]'::jsonb);
end;
$$;

create function public.athlete_focus_items(p_athlete_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.read_coach_focus_items(p_athlete_id);
$$;

create function private.save_coach_focus_item(
  p_athlete_id uuid,p_item_id uuid,p_title text,p_staff_note text,p_target_date date,
  p_shared boolean,p_completed boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.coach_focus_items; saved_id uuid; clean_title text; clean_note text;
begin
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active staff required' using errcode='42501';
  end if;
  if p_athlete_id is null or not exists(select 1 from public.athletes where id=p_athlete_id) then
    raise exception 'Unknown athlete';
  end if;
  clean_title:=btrim(coalesce(p_title,''));
  clean_note:=nullif(btrim(coalesce(p_staff_note,'')),'');
  if length(clean_title) not between 1 and 120 or clean_title ~ '[[:cntrl:]]' or
    length(coalesce(clean_note,'')) > 600 or clean_note ~ '[[:cntrl:]]' or
    p_shared is null or p_completed is null or
    (p_target_date is not null and p_target_date not between date '2026-09-01' and date '2027-12-31') then
    raise exception 'Invalid focus item';
  end if;
  if p_item_id is not null then
    select * into existing from public.coach_focus_items where id=p_item_id for update;
    if existing.id is null or existing.athlete_id<>p_athlete_id then
      raise exception 'Focus item not found';
    end if;
  end if;
  if not p_completed and (p_item_id is null or existing.completed_at is not null) and
    (select count(*) from public.coach_focus_items where athlete_id=p_athlete_id and completed_at is null)>=2 then
    raise exception 'Complete a focus item before adding another';
  end if;
  if p_item_id is null then
    insert into public.coach_focus_items(athlete_id,title,staff_note,target_date,shared_with_player,completed_at,created_by)
    values(p_athlete_id,clean_title,clean_note,p_target_date,p_shared,case when p_completed then now() else null end,auth.uid())
    returning id into saved_id;
  else
    update public.coach_focus_items set title=clean_title,staff_note=clean_note,target_date=p_target_date,
      shared_with_player=p_shared,completed_at=case when p_completed then coalesce(completed_at,now()) else null end,
      updated_at=now() where id=p_item_id returning id into saved_id;
  end if;
  insert into public.audit_events(actor_id,event_type,target_id,details)
    values(auth.uid(),'coach_focus_saved',p_athlete_id,jsonb_build_object('item_id',saved_id,'shared',p_shared,'completed',p_completed));
  return saved_id;
end;
$$;

create function public.staff_save_focus_item(
  p_athlete_id uuid,p_item_id uuid,p_title text,p_staff_note text,p_target_date date,
  p_shared boolean,p_completed boolean
) returns uuid language sql security invoker set search_path = '' as $$
  select private.save_coach_focus_item(p_athlete_id,p_item_id,p_title,p_staff_note,p_target_date,p_shared,p_completed);
$$;
revoke all on function private.read_coach_focus_items(uuid),public.athlete_focus_items(uuid),
  private.save_coach_focus_item(uuid,uuid,text,text,date,boolean,boolean),
  public.staff_save_focus_item(uuid,uuid,text,text,date,boolean,boolean) from public,anon,authenticated;
grant execute on function private.read_coach_focus_items(uuid),public.athlete_focus_items(uuid),
  private.save_coach_focus_item(uuid,uuid,text,text,date,boolean,boolean),
  public.staff_save_focus_item(uuid,uuid,text,text,date,boolean,boolean) to authenticated;
commit;
