-- Add owner-private board ordering and field depth. Existing documents and audit receipts stay unchanged.
alter function private.valid_boxer_draft(jsonb) rename to valid_boxer_draft_base;
create function private.valid_boxer_draft(d jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare plan jsonb; item jsonb; roster_ids text[]; ranked text[]:='{}'; placed text[]; t integer; ordinal bigint; n text; eligible integer;
begin
  if not private.valid_boxer_draft_base(d-'planning') then return false; end if;
  if not d ? 'planning' then return true; end if;
  plan:=d->'planning';
  if jsonb_typeof(plan)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(plan) key) is distinct from array['bigBoard','placements']
    or jsonb_typeof(plan->'bigBoard')<>'array' or jsonb_typeof(plan->'placements')<>'array' or jsonb_array_length(plan->'placements')<>2 then return false; end if;
  select count(*) into eligible from jsonb_array_elements(d->'players') p where p->>'group'<>'Injured / Student Assistants';
  if jsonb_array_length(plan->'bigBoard')<>eligible then return false; end if;
  for item in select value from jsonb_array_elements(plan->'bigBoard') loop
    n:=item#>>'{}';
    if jsonb_typeof(item)<>'string' or n=any(ranked) or not exists(select 1 from jsonb_array_elements(d->'players') p where p->>'id'=n and p->>'group'<>'Injured / Student Assistants') then return false; end if;
    ranked:=array_append(ranked,n);
  end loop;
  for t in 0..1 loop
    roster_ids:='{}';placed:='{}';
    for ordinal in 0..jsonb_array_length(d->'teams'->t->'captains')-1 loop roster_ids:=array_append(roster_ids,'captain-'||t||'-'||ordinal); end loop;
    for item,ordinal in select value, ordinality from jsonb_array_elements(d->'picks') with ordinality loop
      if (case when (ordinal-1)%4 in (0,3) then 0 else 1 end)=t then roster_ids:=array_append(roster_ids,item#>>'{}'); end if;
    end loop;
    if jsonb_typeof(plan->'placements'->t)<>'array' or jsonb_array_length(plan->'placements'->t)>cardinality(roster_ids)*10 then return false; end if;
    for item in select value from jsonb_array_elements(plan->'placements'->t) loop
      n:=item->>'playerId';
      if jsonb_typeof(item)<>'object' or (select array_agg(key order by key) from jsonb_object_keys(item) key) is distinct from array['playerId','position']
        or jsonb_typeof(item->'playerId')<>'string' or not n=any(roster_ids) or (n||'|'||(item->>'position'))=any(placed)
        or jsonb_typeof(item->'position')<>'string' or item->>'position' not in ('P','C','1B','2B','3B','SS','LF','CF','RF','DH') then return false; end if;
      placed:=array_append(placed,n||'|'||(item->>'position'));
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_boxer_draft(jsonb),private.valid_boxer_draft_base(jsonb) from public,anon,authenticated;
