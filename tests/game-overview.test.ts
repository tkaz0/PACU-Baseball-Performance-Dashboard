import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { gameOverviewMetrics } from "@/lib/game-overview";
import { PlayerOverview } from "@/components/player-overview";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { getPlayerPerformance } from "@/lib/player-performance";
import type { SharedGameStat } from "@/lib/game-server";
import type { GameComparison } from "@/lib/game-metrics";
const rows = (counts: Record<string,number>): SharedGameStat[] => Object.entries(counts).map(([metric,value]) => ({source:"qpa_fall_2026",athlete_id:"fictional-a",metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:"fictional-current",fetched_at:"2026-09-13T01:00:00Z",content_hash:"a".repeat(64)}));
const stats = rows({pa:10,ab:8,base_hit:4,bb:1,hbp:0,sac_fly:1,punchies:2,pumps:1,sb:1,gdp:0});
const c: GameComparison = {metric:"batting_avg",source:"qpa_fall_2026",eventId:"",value:.5,percentile:90,sampleSize:8,snapshotId:"fictional-current"};
it("binds overview percentiles to exact source/event/snapshot/value and rejects ambiguous comparisons", () => {
  expect(gameOverviewMetrics(stats,[c]).find(m=>m.metric==='batting_avg')?.comparison).toEqual(c);
  for (const bad of [{snapshotId:'old'},{eventId:'wrong'},{source:'pitching_fall_2026'},{value:.6},{sampleSize:4},{percentile:NaN},{percentile:101}]) expect(gameOverviewMetrics(stats,[{...c,...bad}]).find(m=>m.metric==='batting_avg')?.comparison).toBeNull();
  expect(gameOverviewMetrics(stats,[c,c]).find(m=>m.metric==='batting_avg')?.comparison).toBeNull();
  expect(gameOverviewMetrics([...stats,{...stats[0],athlete_id:'fictional-b'}],[c])).toEqual([]);
});
it("withholds invalid OBP and duplicate source rows rather than assigning an available percentile", () => {
  const inconsistent=stats.map(r=>r.metric==='pa'?{...r,value:8}:r);
  expect(gameOverviewMetrics(inconsistent,[{...c,metric:'batting_obp'}]).some(m=>m.metric==='batting_obp')).toBe(false);
  expect(gameOverviewMetrics([...stats,stats[0]],[c])).toEqual([]);
});
it("uses only the latest dated pitching event and keeps its matching comparison", () => {
  const pitch=(event:string,date:string):SharedGameStat[]=>rows({pitches:20,strike_pct:60,k:2,bb_outcome:1}).map(r=>({...r,source:'pitching_fall_2026',scope:'pitching_event',event_id:event,played_on:date,unit:r.metric==='strike_pct'?'%':'count'}));
  const m=gameOverviewMetrics([...pitch('old','2026-09-12'),...pitch('new','2026-09-13')],[{...c,source:'pitching_fall_2026',metric:'strike_pct',eventId:'new',value:60}]);
  expect(m.every(r=>r.eventId==='new')).toBe(true); expect(m[0].comparison).not.toBeNull(); expect(m[0].opportunities).toBe(20);
  expect(m.filter(r=>r.insightEligible).map(r=>r.metric)).toEqual(['strike_pct']);
});
it("populates strengths and weaknesses from verified game rates with sample-size context", () => {
  const html=renderToStaticMarkup(createElement(PlayerOverview,{cards:[],gameStats:stats,gameComparisons:[c,{...c,metric:'batting_k_pct',value:20,percentile:10},{...c,metric:'pumps',value:1,percentile:100}]}));
  const strengths=html.split('aria-label="Strengths"')[1].split('aria-label="Weaknesses"')[0];
  const weaknesses=html.split('aria-label="Weaknesses"')[1].split('aria-label="Biggest jumps"')[0];
  expect(strengths).toContain('AVG'); expect(strengths).toContain('8 AB'); expect(strengths).toContain('Limited sample'); expect(strengths).not.toContain('>HR<');
  expect(weaknesses).toContain('K %'); expect(weaknesses).toContain('10 PA');
  expect(html).toContain('aria-label="Game Stats percentiles"'); expect(html).toContain('aria-valuenow="90"'); expect(html).not.toContain('data-overview-game-metric="ab"');
});
it("shows only the requested physicality trio in Overview while keeping body ranks descriptive", () => {
  const codes=Array.from({length:5},(_,i)=>`SYN-00${i+1}`);
  const readings=codes.flatMap((code,i)=>[['Weight',180+i,'lb'],['Height',70+i,'in'],['Muscle Mass',140+i,'lb'],['RENPHO Body Score',80+i,'points'],['Body Fat Percentage',18+i,'%']].map(([metric,value,unit])=>({id:`${code}-${metric}`,athlete_code:code,metric:String(metric),value:Number(value),unit:String(unit),measured_at:'2026-09-13',source:'RENPHO',source_file:'fictional.png',source_sheet:'RENPHO report · Page 1',source_row:2,file_hash:'a'.repeat(64)})));
  const performance=getPlayerPerformance({readings,athleteCode:codes[0],cohortAthleteCodes:codes});
  const html=renderToStaticMarkup(createElement(PlayerOverview,{cards:performance.body}));
  for(const key of ['muscle_mass','body_score','body_fat_pct'])expect(html).toContain(`data-overview-metric="${key}"`);
  for(const key of ['weight','height'])expect(html).not.toContain(`data-overview-metric="${key}"`);
  expect(html).toContain('Descriptive rank');expect(html.split('aria-label="Strengths"')[1].split('aria-label="Weaknesses"')[0]).not.toContain('role="meter"');
});
it("removes standalone batting Hits and AB cards but retains AVG denominator", () => {
  const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats,comparisons:[c]}));
  expect(html).toContain('8 AB');expect(html).toContain('.500');expect(html).not.toContain('About Hits');expect(html).not.toContain('aria-label="About AB"');
});
