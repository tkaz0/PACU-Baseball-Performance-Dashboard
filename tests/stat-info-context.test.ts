import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { StatGuideContext } from "@/lib/stat-benchmarks";
import type { AnalyticsReading } from "@/lib/analytics";
import type { CoachingData, CoachingPlayer } from "@/lib/coaching-tools";
import type { SharedGameStat } from "@/lib/game-server";
import type { Measurement } from "@/lib/imports/engine";
const seen=vi.hoisted(()=>[] as ({metric:string}&StatGuideContext)[]);
vi.mock("@/components/stat-info",()=>({StatInfo:(props:{metric:string}&StatGuideContext)=>{seen.push(props);return null;}}));
vi.mock("@/app/(workspace)/analytics/view-actions",()=>({saveAnalyticsView:vi.fn(),archiveAnalyticsView:vi.fn()}));
import { AnalyticsExplorer } from "@/components/analytics-explorer";
import { TeamProgress } from "@/components/team-progress";
import { PlayerComparison } from "@/components/player-comparison";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { PlayerOverview } from "@/components/player-overview";
import { RenphoCharts } from "@/components/renpho-charts";
import { RenphoBodyScore } from "@/components/renpho-body-score";
import { getPlayerPerformance } from "@/lib/player-performance";
import { measurementGuideContext } from "@/lib/stat-benchmarks";
const player:CoachingPlayer={id:"fictional-a",code:"SYN-001",name:"Example North",academicClass:"Junior",position:"OF",playerType:"position",bats:"R",throws:"R"};
const reading=(patch:Partial<AnalyticsReading>={}):AnalyticsReading=>({id:"fictional-reading",athleteId:player.id,metric:"muscle_mass",label:"Muscle Mass",value:150,unit:"lb",source:"RENPHO",date:"2026-09-13",importedAt:"2026-09-14T00:00:00Z",...patch});
const measurement=(patch:Partial<Measurement>={}):Measurement=>({id:"fictional-report-reading",athlete_code:player.code,measured_at:"2026-07-13",source:"RENPHO",metric:"Weight",value:150,unit:"lb",source_file:"fictional.pdf",source_sheet:"RENPHO report · Page 1",source_row:1,file_hash:"a".repeat(64),...patch});
const pitch=(counts:Record<string,number>):SharedGameStat[]=>Object.entries(counts).map(([metric,value])=>({source:"pitching_fall_2026",athlete_id:player.id,metric,value,unit:metric==="strike_pct"?"%":"count",scope:"pitching_event",event_id:"fall-2026-week-1",played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:"fictional-snapshot",fetched_at:"2026-09-14T00:00:00Z",content_hash:"a".repeat(64)}));
beforeEach(()=>seen.splice(0));
it("keeps analytics Summer measurements separate and maps only the exact cumulative game display sources",()=>{
 renderToStaticMarkup(createElement(AnalyticsExplorer,{data:{players:[player],readings:[reading({date:"2026-07-13"}),reading({metric:"weight",label:"Weight",value:180,date:"2026-07-13"})]},initialPeriod:"earlier"}));
 expect(seen.find(r=>r.metric==="muscle_mass")).toMatchObject({source:"RENPHO",unit:"lb",period:"summer_2026"});
 seen.splice(0);
 renderToStaticMarkup(createElement(AnalyticsExplorer,{data:{players:[player],readings:[reading({metric:"qpa_game_qpa_pct",label:"Game QPA %",source:"QPA · Fall cumulative (snapshot date)",unit:"%"}),reading({metric:"strike_pct",label:"Pitching Strike %",source:"Pitching · Fall 2026 cumulative (snapshot date)",unit:"%"})]}}));
 expect(seen.find(r=>r.metric==="qpa_game_qpa_pct")).toMatchObject({source:"qpa_fall_2026",unit:"%",period:"fall_2026",eventId:""});
 expect(seen.find(r=>r.metric==="strike_pct")).toMatchObject({source:"pitching_fall_2026",unit:"%",period:"fall_2026",eventId:"fall-2026-cumulative"});
});
it("requests the full approved team comparison for progress and two-player comparison, never those displayed players as a cohort",()=>{
 const data:CoachingData={players:[player,{...player,id:"fictional-b",name:"Example West"}],readings:[reading(),reading({athleteId:"fictional-b",value:155})],games:[]};
 renderToStaticMarkup(createElement(TeamProgress,{data,today:"2026-09-20"}));
 renderToStaticMarkup(createElement(PlayerComparison,{data,today:"2026-09-20"}));
 const info=seen.filter(r=>r.metric==="muscle_mass");expect(info).toHaveLength(2);
 for(const row of info){expect(row).toMatchObject({source:"RENPHO",unit:"lb",period:"fall_2026"});expect(row.cohort).toBeUndefined();}
});
it("uses the actual pitching rate units and exact cumulative event for totals and contact splits",()=>{
 const rows=pitch({pitches:20,strikes:12,strike_pct:60,k:2,bb_outcome:1,h:2,innings_outs:6,r:1,weak_contact:6,hard_contact:2});
renderToStaticMarkup(createElement(AthleteGameStats,{stats:rows}));
 for(const key of ["strike_pct","weak_contact_pct","hard_contact_pct"])
  expect(seen.find(r=>r.metric===key)).toMatchObject({source:"pitching_fall_2026",unit:"%",period:"fall_2026",eventId:"fall-2026-cumulative"});
});
it("carries reading context into overview headlines and the report body-score card",()=>{
 const performance=getPlayerPerformance({readings:[measurement({metric:"RENPHO Body Score",unit:"points",value:85,measured_at:"2026-09-13"})],athleteCode:player.code});
 renderToStaticMarkup(createElement(PlayerOverview,{cards:performance.body}));
 renderToStaticMarkup(createElement(RenphoBodyScore,{reading:performance.body.find(card=>card.metric.key==="body_score")!.latest}));
 const scores=seen.filter(r=>r.metric==="body_score");expect(scores.length).toBeGreaterThanOrEqual(2);
 for(const row of scores)expect(row).toMatchObject({source:"RENPHO",unit:"points",period:"fall_2026",value:85});
});
it("uses the report's actual season and refuses to substitute Fall for unsupported historical dates",()=>{
 renderToStaticMarkup(createElement(RenphoCharts,{readings:[measurement()],batches:[],athleteCode:player.code}));
 expect(seen.find(r=>r.metric==="Weight")).toMatchObject({source:"RENPHO",unit:"lb",period:"summer_2026",value:150});
 for(const measured_at of ["2025-09-13","2026-02-30","2026-05-31","2027-01-01"]){
  const context=measurementGuideContext(measurement({measured_at}));expect(context.source).toBeUndefined();expect(context.period).toBeUndefined();
 }
 expect(measurementGuideContext(measurement({measured_at:"2026-09-01"}))).toMatchObject({source:"RENPHO",period:"fall_2026"});
});
