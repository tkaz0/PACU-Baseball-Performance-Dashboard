-- Owner-requested October 9: 8+ Pitch PA % = QPA sheet 8+ Pitch appearances / PA x 100, a patience rate.
-- Replaces only the read-only rank projection (adding one rate from existing saved counts) and the
-- leaderboard metric list. No source data, RLS, grants or import mappings change. Deploy the compatible app first.
begin;
create or replace function private.game_rank_values() returns table(athlete_id uuid,source text,event_id text,played_on date,metric text,value float8,unit text,snapshot_id uuid,fetched_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with entries as (
 select g.* from public.game_stats g join public.game_sync_state c on c.source=g.source and c.snapshot_id=g.snapshot_id
 join public.athlete_seasons s on s.athlete_id=g.athlete_id and s.season='2026-27'
 where (s.roster_status is null or s.roster_status in ('active','redshirt'))
 ), pitch_periods as (
 select athlete_id,source,snapshot_id,count(distinct event_id) periods,
 bool_or(event_id ~ '^fall-2026-week-[1-5]$') weekly,
 bool_or(event_id !~ '^fall-2026-week-[1-5]$') dated from entries where source='pitching_fall_2026' group by athlete_id,source,snapshot_id
 ), complete_counts as (
 select e.athlete_id,e.source,'fall-2026-cumulative'::text event_id,null::date played_on,e.metric,sum(e.value)::float8 value,'count'::text unit,e.snapshot_id,max(e.fetched_at) fetched_at
 from entries e join pitch_periods p using(athlete_id,source,snapshot_id)
 where e.unit='count' and not(p.weekly and p.dated)
 group by e.athlete_id,e.source,e.snapshot_id,e.metric,p.periods having count(*)=p.periods
 ), raw as (
 select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from entries where source='qpa_fall_2026'
 union all select * from complete_counts
 union all select s.athlete_id,s.source,s.event_id,s.played_on,'strike_pct',100::float8*s.value/nullif(p.value,0),'%',s.snapshot_id,greatest(s.fetched_at,p.fetched_at)
 from complete_counts s join complete_counts p using(athlete_id,source,event_id,snapshot_id) where s.metric='strikes' and p.metric='pitches' and p.value>0 and s.value<=p.value
 ), q as (
 select athlete_id,source,snapshot_id,max(fetched_at) fetched_at,private.qpa_batting_counts(jsonb_object_agg(metric,value)) v from raw where source='qpa_fall_2026' group by athlete_id,source,snapshot_id
 ), rates as (
 select q.*,r.metric,r.top,r.bottom,r.unit from q cross join lateral (values
 ('batting_avg',(v->>'base_hit')::float8,(v->>'ab')::float8,'avg'),
 ('batting_obp',(v->>'base_hit')::float8+(v->>'bb')::float8+(v->>'hbp')::float8,(v->>'ab')::float8+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8,'avg'),
 ('batting_hr_pct',(v->>'pumps')::float8,(v->>'pa')::float8,'%'),
 ('batting_bb_pct',(v->>'bb')::float8,(v->>'pa')::float8,'%'),
 ('batting_k_pct',(v->>'punchies')::float8,(v->>'pa')::float8,'%'),
 ('batting_8plus_pct',(v->>'eight_plus_pitches')::float8,(v->>'pa')::float8,'%'),
 ('batting_hh_pct',(v->>'hh_base_hit')::float8+(v->>'three_eight_hh')::float8+(v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8,coalesce(v->>'_qpa_sheet_ab',v->>'ab')::float8-(v->>'punchies')::float8-(v->>'sac_bunt')::float8,'%')
 ) r(metric,top,bottom,unit)
 ), pitch as (
 select athlete_id,source,event_id,played_on,snapshot_id,max(fetched_at) fetched_at,jsonb_object_agg(metric,value) v from raw where source='pitching_fall_2026' group by athlete_id,source,event_id,played_on,snapshot_id
 ), pitch_rates as (
 select p.*,r.metric,r.top,(v->>'innings_outs')::float8 outs from pitch p cross join lateral (values
 ('pitching_k9',(v->>'k')::float8),('pitching_bb9',(v->>'bb_outcome')::float8),('pitching_r9',(v->>'r')::float8)
 ) r(metric,top)
 ), contact_rates as (
 select p.*,r.metric,r.top,(v->>'weak_contact')::float8+(v->>'hard_contact')::float8 contacts from pitch p cross join lateral (values
 ('weak_contact_pct',(v->>'weak_contact')::float8),('hard_contact_pct',(v->>'hard_contact')::float8)
 ) r(metric,top)
 ), power_parts as (
 select q.*, (v->>'base_hit')::float8 hits,(v->>'hh_extra_base_hit')::float8 xbh,(v->>'pumps')::float8 hr,(v->>'ab')::float8 ab,
 (v->>'base_hit')::float8+(v->>'hh_extra_base_hit')::float8+3::float8*(v->>'pumps')::float8 bases,
 .882::float8*((v->>'base_hit')::float8-(v->>'hh_extra_base_hit')::float8-(v->>'pumps')::float8)+1.252::float8*(v->>'hh_extra_base_hit')::float8+2.037::float8*(v->>'pumps')::float8 weighted_hits
 from q where (v->>'ab')::float8>0 and (v->>'base_hit')::float8<=(v->>'ab')::float8
 and (v->>'hh_extra_base_hit')::float8+(v->>'pumps')::float8<=(v->>'base_hit')::float8
 ), production as (
 select p.*,bases+(v->>'bb')::float8+(v->>'hbp')::float8 top,(v->>'pa')::float8 bottom
 from power_parts p where (v->>'pa')::float8>0
 and ab+(v->>'bb')::float8+(v->>'hbp')::float8+(v->>'sac_fly')::float8<=(v->>'pa')::float8
 ), production_baseline as (
 select source,snapshot_id,sum(top)/nullif(sum(bottom),0) baseline from production group by source,snapshot_id having count(*)>=5
 ) select athlete_id,source,event_id,played_on,metric,value,unit,snapshot_id,fetched_at from raw
 union all select athlete_id,source,'',null,metric,(case when unit='%' then 100::float8 else 1::float8 end)*(top/nullif(bottom,0)),unit,snapshot_id,fetched_at
 from rates where (metric<>'batting_hr_pct' or (v->>'base_hit') is null or top<=(v->>'base_hit')::float8) and (metric<>'batting_obp' or (v->>'pa') is null or bottom<=(v->>'pa')::float8) and bottom>0 and top>=0 and top<=bottom and (metric not in ('batting_avg','batting_obp') or (v->>'base_hit')::float8<=(v->>'ab')::float8)
 union all select athlete_id,source,event_id,played_on,metric,27::float8*top/nullif(outs,0),'per9',snapshot_id,fetched_at from pitch_rates where outs>0 and top>=0
 union all select athlete_id,source,event_id,played_on,metric,100::float8*top/nullif(contacts,0),'%',snapshot_id,fetched_at from contact_rates where top>=0 and contacts>0 and top<=contacts
 union all select athlete_id,source,'',null,r.metric,r.value,'avg',snapshot_id,fetched_at from power_parts p
 cross join lateral (values ('batting_est_slg',bases/ab),('batting_est_iso',(xbh+3::float8*hr)/ab)) r(metric,value)
 union all select athlete_id,source,'',null,'batting_est_wobacon',weighted_hits/nullif(ab-(v->>'punchies')::float8+(v->>'sac_fly')::float8,0),'avg',snapshot_id,fetched_at from power_parts
 where (v->>'punchies')::float8+hits<=ab and ab-(v->>'punchies')::float8+(v->>'sac_fly')::float8>0
 union all select p.athlete_id,p.source,'',null,'batting_production_plus',100::float8*(p.top/p.bottom)/b.baseline,'index',p.snapshot_id,p.fetched_at from production p join production_baseline b using(source,snapshot_id) where b.baseline>0
 union all select athlete_id,source,event_id,played_on,'pitching_whip',3::float8*((v->>'h')::float8+(v->>'bb_outcome')::float8)/nullif((v->>'innings_outs')::float8,0),'decimal',snapshot_id,fetched_at from pitch where (v->>'innings_outs')::float8>0 and (v->>'h') is not null and (v->>'bb_outcome') is not null
 union all select athlete_id,source,event_id,played_on,'pitching_k_bb',(v->>'k')::float8/nullif((v->>'bb_outcome')::float8,0),'decimal',snapshot_id,fetched_at from pitch where (v->>'bb_outcome')::float8>0 and (v->>'k') is not null
$$;

create or replace function private.game_leaderboards() returns jsonb language plpgsql stable security definer set search_path='' set extra_float_digits=3 as $$
declare result jsonb;
begin
 if not (private.has_role('admin') or private.has_role('coach') or private.has_role('player')) then raise exception 'Active player or staff access required' using errcode='42501'; end if;
 -- Materialize denominator rows once; do not rerun the full team projection for every rank.
 with count_rows as materialized (select * from private.game_rank_values())
 select coalesce(jsonb_agg(jsonb_build_object('metric',r.metric,'source',r.source,'eventId',r.event_id,'playedOn',r.played_on,'value',r.value,'unit',r.unit,'rank',r.place,'name',concat_ws(' ',coalesce(nullif(a.preferred_name,''),a.first_name),a.last_name),'code',a.athlete_code,'profileId',case when private.can_read_athlete(a.id) then a.id else null end,'updatedAt',r.fetched_at,'percentile',r.percentile,'sampleSize',r.sample_size,'opportunities',case when o.n>0 then o.n else null end) order by r.source,r.event_id,r.metric,r.place,a.athlete_code),'[]'::jsonb) into result
 from private.game_ranked() r join public.athletes a on a.id=r.athlete_id
 left join lateral (
 select case when r.source='qpa_fall_2026' then case
 when r.metric in ('batting_avg','batting_est_slg','batting_est_iso') then (v->>'ab')::numeric
 when r.metric='batting_est_wobacon' then (v->>'ab')::numeric-(v->>'punchies')::numeric+(v->>'sac_fly')::numeric
 when r.metric='batting_obp' then (v->>'ab')::numeric+(v->>'bb')::numeric+(v->>'hbp')::numeric+(v->>'sac_fly')::numeric
 when r.metric='batting_hh_pct' then coalesce(v->>'_qpa_sheet_ab',v->>'ab')::numeric-(v->>'punchies')::numeric-(v->>'sac_bunt')::numeric
 else (v->>'pa')::numeric end
 when r.metric='pitching_k_bb' then (v->>'bb_outcome')::numeric when r.metric in ('pitching_k9','pitching_bb9','pitching_r9','pitching_whip') then (v->>'innings_outs')::numeric when r.metric in ('weak_contact_pct','hard_contact_pct') then (v->>'weak_contact')::numeric+(v->>'hard_contact')::numeric when r.metric='strike_pct' then (v->>'pitches')::numeric else null end n
 from (select case when r.source='qpa_fall_2026' then private.qpa_batting_counts(jsonb_object_agg(g.metric,g.value)) else jsonb_object_agg(g.metric,g.value) end v from count_rows g
 where g.athlete_id=r.athlete_id and g.source=r.source and g.snapshot_id=r.snapshot_id and coalesce(g.event_id,'')=r.event_id) counts
 ) o on true
 where (r.source='qpa_fall_2026' and r.metric in ('batting_production_plus','batting_est_slg','batting_est_iso','batting_est_wobacon','batting_avg','batting_obp','batting_hr_pct','batting_bb_pct','batting_k_pct','batting_8plus_pct','batting_hh_pct','qpa_pct','pumps','sb','gdp'))
 or (r.source='pitching_fall_2026' and r.metric in ('pitching_whip','pitching_k_bb','pitching_k9','pitching_bb9','pitching_r9','strike_pct','weak_contact_pct','hard_contact_pct','k','bb_outcome','pitches'));
 if jsonb_array_length(result)>10000 then raise exception 'Game leaderboard limit exceeded'; end if;
 return result;
end $$;

revoke all on function private.game_rank_values() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
