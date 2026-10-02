-- Owner-requested player headshots from the public Pacific athletics roster (goboxers.com).
-- Rows are reviewed name matches added by the owner; no row means the player shows initials.
-- Only the site-relative image path is stored; the app builds the goboxers.com URL.
begin;
create table public.athlete_headshots (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  image_path text not null check (image_path ~ '^/images/[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}/[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)$'),
  source text not null default 'goboxers.com baseball roster' check (length(source) <= 120),
  reviewed_at timestamptz not null default now()
);
alter table public.athlete_headshots enable row level security;
revoke all on public.athlete_headshots from public, anon, authenticated;
grant select on public.athlete_headshots to authenticated;
-- Staff and linked players read headshots for athletes they can already read.
create policy athlete_headshots_read on public.athlete_headshots for select to authenticated using (private.can_read_athlete(athlete_id));

-- Leaderboards show teammates by PAC code; this returns only code → public image path for active accounts.
create function private.team_headshots() returns table(athlete_code text, image_path text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active() then raise exception 'Active account required' using errcode = '42501'; end if;
  return query select a.athlete_code, h.image_path from public.athlete_headshots h join public.athletes a on a.id = h.athlete_id;
end;
$$;
create function public.team_headshots() returns table(athlete_code text, image_path text) language sql stable security invoker set search_path = '' as $$ select * from private.team_headshots(); $$;
revoke all on function private.team_headshots(), public.team_headshots() from public, anon, authenticated;
grant execute on function private.team_headshots(), public.team_headshots() to authenticated;
commit;
