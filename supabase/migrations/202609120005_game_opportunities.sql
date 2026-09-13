-- Add opportunity counts beside authorized game rankings. No general peer game-row access.
create or replace function private.game_leaderboards() returns jsonb language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
 if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then raise exception 'Active player or staff access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('metric',r.metric,'source',r.source,'eventId',r.event_id,'playedOn',r.played_on,'value',r.value,'unit',r.unit,'rank',r.place,'name',concat_ws(' ',coalesce(nullif(a.preferred_name,''),a.first_name),a.last_name),'code',a.athlete_code,'profileId',case when private.can_read_athlete(a.id) then a.id else null end,'updatedAt',r.fetched_at,'percentile',r.percentile,'sampleSize',r.sample_size,'opportunities',case when o.n>0 then o.n else null end) order by r.source,r.event_id,r.metric,r.place,a.athlete_code),'[]'::jsonb) into result
 from private.game_ranked() r join public.athletes a on a.id=r.athlete_id
 left join lateral (
 select case when r.source='qpa_fall_2026' then case
 when r.metric='batting_avg' then (v->>'ab')::numeric
 when r.metric='batting_obp' then (v->>'ab')::numeric+(v->>'bb')::numeric+(v->>'hbp')::numeric+(v->>'sac_fly')::numeric
 when r.metric='batting_hh_pct' then (v->>'ab')::numeric-(v->>'punchies')::numeric-(v->>'sac_bunt')::numeric
 else (v->>'pa')::numeric end
 when r.metric='strike_pct' then (v->>'pitches')::numeric else null end n
 from (select jsonb_object_agg(g.metric,g.value) v from public.game_stats g
 where g.athlete_id=r.athlete_id and g.source=r.source and g.snapshot_id=r.snapshot_id and coalesce(g.event_id,'')=r.event_id) counts
 ) o on true
 where (r.source='qpa_fall_2026' and r.metric in ('batting_avg','batting_obp','batting_hr_pct','batting_bb_pct','batting_k_pct','batting_hh_pct','qpa_pct','pumps','sb','gdp'))
 or (r.source='pitching_fall_2026' and r.metric in ('strike_pct','k','bb_outcome','pitches'));
 if jsonb_array_length(result)>10000 then raise exception 'Game leaderboard limit exceeded'; end if;
 return result;
end $$;

