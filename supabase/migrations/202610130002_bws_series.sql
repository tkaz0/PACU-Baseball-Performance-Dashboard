-- Owner-requested October 13: BWS series planning. The private team plan may now include an optional
-- `series` object (participation minimums, innings per game, and opposing players to scout).
-- Only the structural check changes; plans saved earlier stay valid. RLS, grants and receipts are unchanged.
begin;
create or replace function private.valid_bws_team_plan(d jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare p jsonb; o jsonb; links text[]:='{}'; ids text[]:='{}'; opponents text[]:='{}';
begin
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>150000
    or (select array_agg(key order by key) from jsonb_object_keys(d) key) not in
      (array['depth','games','lineups','name','notes','players','version'], array['depth','games','lineups','name','notes','players','series','version'])
    or d->'version' is distinct from '1'::jsonb or not private.draft_text(d->'name',60)
    or jsonb_typeof(d->'players')<>'array' or jsonb_array_length(d->'players')>40
    or jsonb_typeof(d->'depth')<>'object' or jsonb_typeof(d->'lineups')<>'array' or jsonb_array_length(d->'lineups')>12
    or jsonb_typeof(d->'games')<>'array' or jsonb_array_length(d->'games')>40 or jsonb_typeof(d->'notes')<>'array' or jsonb_array_length(d->'notes')>40 then return false; end if;
  for p in select value from jsonb_array_elements(d->'players') loop
    if jsonb_typeof(p)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from array['athleteId','id','name','role']
      or not private.draft_text(p->'name',80) or (p->>'role') not in ('pitcher','position','two_way')
      or jsonb_typeof(p->'id')<>'string' or (p->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or lower(p->>'id')=any(ids) then return false; end if;
    if p->'athleteId'<>'null'::jsonb then
      if jsonb_typeof(p->'athleteId')<>'string' or (p->>'athleteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or lower(p->>'athleteId')=any(links) or not exists(select 1 from public.athletes where id=(p->>'athleteId')::uuid) then return false; end if;
      links:=array_append(links,lower(p->>'athleteId'));
    end if;
    ids:=array_append(ids,lower(p->>'id'));
  end loop;
  if d ? 'series' then
    if jsonb_typeof(d->'series')<>'object' or jsonb_typeof(d#>'{series,opponents}')<>'array' or jsonb_array_length(d#>'{series,opponents}')>40 then return false; end if;
    for o in select value from jsonb_array_elements(d#>'{series,opponents}') loop
      if jsonb_typeof(o)<>'object' or jsonb_typeof(o->'athleteId')<>'string' or (o->>'athleteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or lower(o->>'athleteId')=any(links) or lower(o->>'athleteId')=any(opponents) or not exists(select 1 from public.athletes where id=(o->>'athleteId')::uuid) then return false; end if;
      opponents:=array_append(opponents,lower(o->>'athleteId'));
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_bws_team_plan(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
