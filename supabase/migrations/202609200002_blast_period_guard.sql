-- New weekly reports must describe distinct swings. Retain every existing observation.
create function private.guard_blast_report_period() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.source !~ '^Blast Motion · (Average|P95) · ' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(72104001);
  if not (private.has_role('admin') or private.has_role('coach')) then
    raise exception 'Active administrator or coach required' using errcode='42501';
  end if;
  if exists (
    select 1 from public.performance_measurements m
    where m.athlete_id=new.athlete_id and m.source ~ '^Blast Motion · (Average|P95) · '
      and split_part(m.source,' · ',2)=split_part(new.source,' · ',2)
      and m.source<>new.source
      and split_part(split_part(m.source,' · ',3),':',1)::date<=split_part(split_part(new.source,' · ',3),':',2)::date
      and split_part(split_part(m.source,' · ',3),':',2)::date>=split_part(split_part(new.source,' · ',3),':',1)::date
  ) then
    raise exception 'Blast report dates overlap a saved report for this player. Use only new swings and non-overlapping dates.' using errcode='23505';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_blast_report_period() from public,anon,authenticated;
create trigger guard_blast_report_period before insert on public.performance_measurements
for each row execute function private.guard_blast_report_period();
