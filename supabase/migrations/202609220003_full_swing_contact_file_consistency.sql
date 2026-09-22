begin;
-- One Full Swing file has one reviewed date, category and display name, even if
-- additional batters from that same file are matched in a later additive save.
create function private.check_full_swing_contact_file_consistency() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior public.full_swing_contacts;
begin
  select * into prior from public.full_swing_contacts where file_hash=new.file_hash limit 1;
  if prior.file_hash is not null and
    (prior.played_on<>new.played_on or prior.category<>new.category or prior.source_file<>new.source_file) then
    raise exception 'Source file category, date or name changed; review required';
  end if;
  return new;
end;
$$;
revoke all on function private.check_full_swing_contact_file_consistency() from public,anon,authenticated;
create trigger full_swing_contact_file_consistency before insert on public.full_swing_contacts
for each row execute function private.check_full_swing_contact_file_consistency();
commit;
