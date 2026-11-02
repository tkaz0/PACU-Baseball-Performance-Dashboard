-- Owner-requested November 2: the Boxer World Series is over and the owner's team won. BWS MVP and Cy Young
-- are chosen from the champion team. The champion roster is a private list of athlete ids (added by the owner
-- in the SQL Editor from the private BWS plan; no names in Git). Signed-in linked players and staff may read only
-- the champions' PAC codes through bws_champion_codes(); names, ids and the private plan are never returned.
begin;
create table private.bws_champions (
  athlete_id uuid primary key references public.athletes(id) on delete restrict,
  added_at timestamptz not null default now()
);
alter table private.bws_champions enable row level security;
revoke all on private.bws_champions from public, anon, authenticated;

create function public.bws_champion_codes() returns text[]
language plpgsql stable security definer set search_path='' as $$
declare staff boolean := private.has_role('admin') or private.has_role('coach');
  own uuid[] := array(select l.athlete_id from public.account_athletes l where l.user_id = (select auth.uid()));
begin
  if not (staff or (private.has_role('player') and cardinality(own) > 0)) then
    raise exception 'Linked player or staff account required' using errcode='42501';
  end if;
  return coalesce(array(select a.athlete_code from private.bws_champions c join public.athletes a on a.id = c.athlete_id order by a.athlete_code), '{}');
end;
$$;
revoke all on function public.bws_champion_codes() from public, anon, authenticated;
grant execute on function public.bws_champion_codes() to authenticated;
notify pgrst,'reload schema';
commit;
