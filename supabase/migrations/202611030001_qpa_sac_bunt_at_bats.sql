-- Owner-confirmed legacy QPA AB includes the later-added Sac Fly count. The exact accounting pattern also holds when
-- the line has sacrifice bunts: sheet AB + BB + HBP + Sac Bunt = PA (the sheet's own Walks + HBP + Sac Bunt column).
-- Read-time calculation only: no source rows, hashes, snapshots, RLS or account changes. Deploy the compatible app first.
create or replace function private.qpa_batting_counts(v jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select case when v ? '_qpa_sheet_ab' then v
 when (v->>'sac_fly')::numeric>0 and (v->>'sac_fly')::numeric<=(v->>'ab')::numeric
 and ((v->>'ab')::numeric+(v->>'bb')::numeric+(v->>'hbp')::numeric=(v->>'pa')::numeric
  or ((v->>'sac_bunt')::numeric>0 and (v->>'ab')::numeric+(v->>'bb')::numeric+(v->>'hbp')::numeric+(v->>'sac_bunt')::numeric=(v->>'pa')::numeric))
 then v || pg_catalog.jsonb_build_object('_qpa_sheet_ab',v->'ab','ab',(v->>'ab')::numeric-(v->>'sac_fly')::numeric)
 else v end
$$;
revoke all on function private.qpa_batting_counts(jsonb) from public,anon,authenticated;
