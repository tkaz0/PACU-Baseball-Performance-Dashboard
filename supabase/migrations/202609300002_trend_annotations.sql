begin;

-- Dated coaching context, independent of immutable measurements and source imports.
create table public.trend_annotations (
  id uuid primary key,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  occurred_on date not null check(occurred_on between date '2026-09-01' and date '2026-12-31'),
  category text not null check(category in ('grip','stance','swing_cue','training','other')),
  scope text not null check(scope in ('all','testing','hitting_practice','hitting_game','pitching_practice','pitching_game')),
  note text not null check(length(note) between 1 and 400 and note=btrim(note) and note !~ '[[:cntrl:]]'),
  shared_with_player boolean not null default false,
  archived boolean not null default false,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trend_annotations_athlete_date on public.trend_annotations(athlete_id,occurred_on desc,id);
alter table public.trend_annotations enable row level security;
revoke all on public.trend_annotations from public,anon,authenticated;

create function private.read_trend_annotations(p_athlete_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare staff boolean; result jsonb;
begin
  if p_athlete_id is null or not private.can_read_athlete(p_athlete_id) then raise exception 'Athlete access denied' using errcode='42501'; end if;
  staff:=private.has_role('admin') or private.has_role('coach');
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'athleteId',a.athlete_id,'date',a.occurred_on,
    'category',a.category,'scope',a.scope,'note',a.note,'shared',a.shared_with_player,'archived',a.archived,'revision',a.revision,'createdAt',a.created_at)
    order by a.occurred_on desc,a.created_at desc,a.id),'[]'::jsonb) into result
  from public.trend_annotations a where a.athlete_id=p_athlete_id and (staff or (a.shared_with_player and not a.archived));
  if jsonb_array_length(result)>100 then raise exception 'Coaching note history limit reached'; end if;
  return result;
end;
$$;
create function public.athlete_trend_annotations(p_athlete_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.read_trend_annotations(p_athlete_id);$$;

create function private.save_trend_annotation(p_athlete_id uuid,p_annotation_id uuid,p_expected_revision integer,p_occurred_on date,
  p_category text,p_scope text,p_note text,p_shared boolean,p_archived boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.trend_annotations; clean_note text:=btrim(coalesce(p_note,'')); saved_revision integer;
  today date:=(now() at time zone 'America/Los_Angeles')::date;
begin
  -- The shared account -> roster lock order protects revocation and player existence.
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  perform pg_catalog.pg_advisory_xact_lock(72104002);
  if not (private.has_role('admin') or private.has_role('coach')) then raise exception 'Active staff required' using errcode='42501'; end if;
  if p_athlete_id is null or p_annotation_id is null or not exists(select 1 from public.athletes where id=p_athlete_id)
    or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483647
    or p_occurred_on is null or p_occurred_on not between date '2026-09-01' and least(today,date '2026-12-31')
    or p_category is null or p_category not in ('grip','stance','swing_cue','training','other')
    or p_scope is null or p_scope not in ('all','testing','hitting_practice','hitting_game','pitching_practice','pitching_game')
    or length(clean_note) not between 1 and 400 or clean_note ~ '[[:cntrl:]]' or p_shared is null or p_archived is null
    then raise exception 'Invalid coaching note' using errcode='22023'; end if;
  select * into existing from public.trend_annotations where id=p_annotation_id for update;
  if (existing.id is null and p_expected_revision<>0) or
    (existing.id is not null and (existing.athlete_id<>p_athlete_id or existing.revision<>p_expected_revision)) then
    raise exception 'Coaching note changed; refresh before saving' using errcode='40001';
  end if;
  if existing.id is null then
    if p_archived or (select count(*) from public.trend_annotations where athlete_id=p_athlete_id)>=100 then
      raise exception 'Coaching note history limit reached or new note archived' using errcode='22023'; end if;
    insert into public.trend_annotations(id,athlete_id,occurred_on,category,scope,note,shared_with_player,created_by)
      values(p_annotation_id,p_athlete_id,p_occurred_on,p_category,p_scope,clean_note,p_shared,auth.uid()) returning revision into saved_revision;
  else
    update public.trend_annotations set occurred_on=p_occurred_on,category=p_category,scope=p_scope,note=clean_note,
      shared_with_player=p_shared,archived=p_archived,revision=revision+1,updated_at=now()
      where id=p_annotation_id returning revision into saved_revision;
  end if;
  -- No free text or source readings in audit event details.
  insert into public.audit_events(actor_id,event_type,target_id,details) values(auth.uid(),'trend_annotation_saved',p_athlete_id,
    jsonb_build_object('annotation_id',p_annotation_id,'revision',saved_revision,'shared',p_shared,'archived',p_archived));
  return jsonb_build_object('id',p_annotation_id,'revision',saved_revision);
end;
$$;
create function public.staff_save_trend_annotation(p_athlete_id uuid,p_annotation_id uuid,p_expected_revision integer,p_occurred_on date,
  p_category text,p_scope text,p_note text,p_shared boolean,p_archived boolean) returns jsonb
language sql security invoker set search_path='' as $$
  select private.save_trend_annotation(p_athlete_id,p_annotation_id,p_expected_revision,p_occurred_on,p_category,p_scope,p_note,p_shared,p_archived);
$$;
revoke all on function private.read_trend_annotations(uuid),public.athlete_trend_annotations(uuid),
  private.save_trend_annotation(uuid,uuid,integer,date,text,text,text,boolean,boolean),
  public.staff_save_trend_annotation(uuid,uuid,integer,date,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function private.read_trend_annotations(uuid),public.athlete_trend_annotations(uuid),
  private.save_trend_annotation(uuid,uuid,integer,date,text,text,text,boolean,boolean),
  public.staff_save_trend_annotation(uuid,uuid,integer,date,text,text,text,boolean,boolean) to authenticated;
commit;
