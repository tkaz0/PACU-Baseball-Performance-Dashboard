-- Add home-run frequency from reviewed Pumps / PA counts. Retain the OBP source-count guard.
create or replace function private.game_rank_values() returns table(athlete_id uuid,source text,event_id text,played_on date,metric text,value float8,unit text,snapshot_id uuid,fetched_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with raw as (
 select g.* from public.game_stats g join public.game_sync_state c on c.source=g.source and c.snapshot_id=g.snapshot_id
 join public.athlete_seasons s on s.athlete_id=g.athlete_id and s.season='2026-27'
 where (s.roster_status is null or s.roster_status in ('active','redshirt'))
 ), q as (
 select athlete_id,source,snapshot_id,max(fetched_at) fetched_at,jsonb_object_agg(metric,value) v from raw where source='qpa_fall_2026' group by athlete_id,source,snapshot_id
 ), rates as (
 select q.*,r.metric,r.top,r.bottom,r.unit from q cross join lateral (values
 ('batting_avg',(v->>'base_hit')::float8,(v->>'ab')::float8,'avg'),
 ('batting_obp',(v->>'base_hit')::float8+(v->>'bb')::float8+(v->>'hbp')::float8,(v->>'ab')::float8+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8,'avg'),
 ('batting_hr_pct',(v->>'pumps')::float8,(v->>'pa')::float8,'%'),
 ('batting_bb_pct',(v->>'bb')::float8,(v->>'pa')::float8,'%'),
 ('batting_k_pct',(v->>'punchies')::float8,(v->>'pa')::float8,'%'),
 ('batting_hh_pct',(v->>'hh_base_hit')::float8+(v->>'three_eight_hh')::float8+(v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8,(v->>'ab')::float8-(v->>'punchies')::float8-(v->>'sac_bunt')::float8,'%')
 ) r(metric,top,bottom,unit)
 ) select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from raw
 union all select athlete_id,source,'',null,metric,(case when unit='%' then 100::float8 else 1::float8 end)*(top/nullif(bottom,0)),unit,snapshot_id,fetched_at
 from rates where (metric<>'batting_hr_pct' or (v->>'base_hit') is null or top<=(v->>'base_hit')::float8) and (metric<>'batting_obp' or (v->>'pa') is null or bottom<=(v->>'pa')::float8) and bottom>0 and top>=0 and top<=bottom and (metric not in ('batting_avg','batting_obp') or (v->>'base_hit')::float8<=(v->>'ab')::float8)
$$;

create or replace function private.game_leaderboards() returns jsonb language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
 if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then raise exception 'Active player or staff access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('metric',r.metric,'source',r.source,'eventId',r.event_id,'playedOn',r.played_on,'value',r.value,'unit',r.unit,'rank',r.place,'name',concat_ws(' ',coalesce(nullif(a.preferred_name,''),a.first_name),a.last_name),'code',a.athlete_code,'profileId',case when private.can_read_athlete(a.id) then a.id else null end,'updatedAt',r.fetched_at,'percentile',r.percentile,'sampleSize',r.sample_size) order by r.source,r.event_id,r.metric,r.place,a.athlete_code),'[]'::jsonb) into result
 from private.game_ranked() r join public.athletes a on a.id=r.athlete_id
 where (r.source='qpa_fall_2026' and r.metric in ('batting_avg','batting_obp','batting_hr_pct','batting_bb_pct','batting_k_pct','batting_hh_pct','qpa_pct','pumps','sb','gdp'))
 or (r.source='pitching_fall_2026' and r.metric in ('strike_pct','k','bb_outcome','pitches'));
 if jsonb_array_length(result)>10000 then raise exception 'Game leaderboard limit exceeded'; end if;
 return result;
end $$;

revoke all on function private.game_rank_values() from public,anon,authenticated;
