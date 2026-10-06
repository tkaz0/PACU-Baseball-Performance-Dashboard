-- Owner-requested speed-up (October 6). A Leaderboards or Analytics page asks for many
-- boards; each team_leaderboard call recomputed every player's latest reading for every
-- metric (and the Blast Fall rollup). team_leaderboards() computes those once per request
-- into transaction-local snapshots and builds each board with an exact copy of the
-- reviewed team_leaderboard logic. Ranks, values, samples, cohorts, role checks and peer
-- profile-link rules are unchanged. No data, RLS or grants on tables change.
begin;
do $$
declare d text;
begin
  d:=pg_get_functiondef('private.team_leaderboard(text,text,text,text)'::regprocedure);
  if position('private.leaderboard_latest()' in d)=0 or position('private.blast_bat_speed_fall()' in d)=0
    or position('FUNCTION private.team_leaderboard(' in d)=0 then
    raise exception 'Reviewed leaderboard shape changed';
  end if;
  d:=replace(d,'FUNCTION private.team_leaderboard(','FUNCTION private.team_leaderboard_from_snapshot(');
  d:=replace(d,'private.leaderboard_latest()','pg_temp.pacu_leaderboard_latest');
  d:=replace(d,'private.blast_bat_speed_fall()','pg_temp.pacu_blast_bat_speed_fall');
  execute d;
end;
$$;
-- Only the batch reader below (same owner) may call the snapshot copy; never callers directly.
revoke all on function private.team_leaderboard_from_snapshot(text,text,text,text) from public,anon,authenticated;

create function public.team_leaderboards(p_selections jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r jsonb; result jsonb:='[]'::jsonb;
begin
  if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then
    raise exception 'Active player or staff access required' using errcode='42501';
  end if;
  if jsonb_typeof(p_selections) is distinct from 'array' or jsonb_array_length(p_selections) not between 1 and 80 then
    raise exception 'Choose 1-80 leaderboards' using errcode='22023';
  end if;
  for r in select value from jsonb_array_elements(p_selections) loop
    if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>4
      or exists(select 1 from jsonb_object_keys(r) k where k not in ('metricKey','source','unit','period'))
      or jsonb_typeof(r->'metricKey') is distinct from 'string' or jsonb_typeof(r->'source') is distinct from 'string'
      or jsonb_typeof(r->'unit') is distinct from 'string' or jsonb_typeof(r->'period') is distinct from 'string' then
      raise exception 'Choose valid leaderboards' using errcode='22023';
    end if;
  end loop;
  -- Transaction-local snapshots, always rebuilt here; dropped at commit.
  drop table if exists pg_temp.pacu_leaderboard_latest;
  drop table if exists pg_temp.pacu_blast_bat_speed_fall;
  create temp table pacu_leaderboard_latest on commit drop as select * from private.leaderboard_latest();
  create temp table pacu_blast_bat_speed_fall on commit drop as select * from private.blast_bat_speed_fall();
  for r in select value from jsonb_array_elements(p_selections) loop
    result:=result||jsonb_build_array(jsonb_build_object('metricKey',r->>'metricKey','source',r->>'source','unit',r->>'unit','period',r->>'period',
      'rows',private.team_leaderboard_from_snapshot(r->>'metricKey',r->>'source',r->>'unit',r->>'period')));
  end loop;
  drop table pg_temp.pacu_leaderboard_latest;
  drop table pg_temp.pacu_blast_bat_speed_fall;
  return result;
end;
$$;
revoke all on function public.team_leaderboards(jsonb) from public,anon,authenticated;
grant execute on function public.team_leaderboards(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
