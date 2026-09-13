import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { comparableTests, compareTests, compareGames, coachingGames, coachingEligible, coachingVariables, coachingValue, progressRows, progressTone, type CoachingData, type CoachingPlayer } from "@/lib/coaching-tools";
import { variableKey, type AnalyticsReading } from "@/lib/analytics";
import { filterComparisonPlayers } from "@/components/comparison-player-picker";
import { TeamProgress } from "@/components/team-progress";
import { PlayerComparison } from "@/components/player-comparison";
import type { SharedGameStat } from "@/lib/game-server";
const a:CoachingPlayer={id:"fictional-a",code:"SYN-001",name:"Example North",academicClass:"Junior",position:"OF",playerType:"position",bats:"R",throws:"R"};
const b:CoachingPlayer={...a,id:"fictional-b",code:"SYN-002",name:"Example West"};
const reading=(value:number,date:string,patch:Partial<AnalyticsReading>={}):AnalyticsReading=>({id:`fictional-${date}-${value}`,athleteId:a.id,metric:"muscle_mass",label:"Muscle Mass",unit:"lb",value,date,source:"RENPHO",importedAt:"2026-09-13T20:00:00Z",...patch});
const data=(readings:AnalyticsReading[]):CoachingData=>({players:[a,b],readings,games:[]});
const today="2026-09-13",key=variableKey(reading(150,today));
it("compares distinct dates within exact sources/units and allows earlier body as previous only",()=>{
 const d=data([reading(150,"2026-08-01"),reading(156,today),reading(200,today,{source:"Other"}),reading(65,today,{unit:"kg"}),reading(180,"2026-09-14")]);
 expect(progressRows(d,key,today,30)[0]).toMatchObject({percent:4,delta:6,due:false,tone:"positive"});
 expect(comparableTests(data([reading(150,"2026-08-01")]),a.id,key,today).latest).toBeNull();
 expect(progressRows(data([reading(150,"2026-08-01")]),key,today,30).every(r=>r.due)).toBe(true);
});
it("withholds ambiguous same-day comparisons and never treats missing or zero as a percentage gain",()=>{
 let d=data([reading(150,"2026-09-01"),reading(151,"2026-09-01"),reading(156,today)]);
 expect(comparableTests(d,a.id,key,today)).toMatchObject({previous:null,conflict:true});
 d=data([reading(155,today),reading(156,today)]);expect(comparableTests(d,a.id,key,today)).toEqual({latest:null,previous:null,conflict:true});
 expect(progressRows(d,key,today,7).find(r=>r.player.id===a.id)?.due).toBe(false);
 d=data([reading(0,"2026-09-01"),reading(6,today)]);expect(progressRows(d,key,today,7)[0]).toMatchObject({delta:6,percent:null});
 expect(progressRows(data([reading(150,today)]),key,today,7)[0]).toMatchObject({delta:null,percent:null});
});
it("ignores duplicate identical readings, invalid calendar dates and future tests",()=>{
 const r=reading(150,today),d=data([r,{...r,id:"duplicate"},reading(200,"2026-09-31"),reading(160,"2026-09-14")]);
 expect(comparableTests(d,a.id,key,today)).toMatchObject({latest:r,previous:null,conflict:false});
 expect(coachingVariables(data([reading(200,"2026-09-31")]),"Physicality",today)).toEqual([]);
});
it("keeps performance Fall-only, honors role/secondary positions and leaves neutral metrics neutral",()=>{
 const pitcher={...a,position:"P",playerType:"pitcher"};
 expect(coachingEligible(pitcher,"home_to_first")).toBe(false);expect(coachingEligible(pitcher,"max_exit_velocity")).toBe(false);expect(coachingEligible(pitcher,"max_pitch_velocity")).toBe(true);
 expect(coachingEligible({...pitcher,playerType:"two_way"},"max_exit_velocity")).toBe(true);
 expect(coachingEligible({...a,secondaryPosition:"SS"},"infield_velocity")).toBe(true);
 const d=data([reading(80,"2026-08-01",{metric:"max_exit_velocity",unit:"mph"}),reading(90,today,{metric:"max_exit_velocity",unit:"mph"})]);
 expect(comparableTests(d,a.id,variableKey(d.readings[0]),today).previous).toBeNull();
 expect(progressTone("weight",4)).toBe("neutral");expect(progressTone("height",4)).toBe("neutral");expect(progressTone("body_fat_pct",-2)).toBe("positive");expect(progressTone("body_score",-4)).toBe("negative");expect(progressTone("home_to_first",-.2)).toBe("positive");
});
it("retest queues honor adjustable intervals and don't invent a prior test",()=>{
 const d=data([reading(150,"2026-09-01")]);
 expect(progressRows(d,key,today,7).filter(r=>r.due)).toHaveLength(2);
 expect(progressRows(d,key,today,14).filter(r=>r.due)).toHaveLength(1);
});
it("comparison uses current results on the same source/unit and withholds large date gaps",()=>{
 const d=data([reading(150,"2026-09-01"),reading(156,today,{athleteId:b.id})]);
 expect(compareTests(d,a.id,b.id,"Physicality",today,7)[0]).toMatchObject({gap:12,comparable:false});
 expect(compareTests(d,a.id,b.id,"Physicality",today,14)[0].comparable).toBe(true);
 expect(compareTests(d,a.id,a.id,"Physicality",today,14)[0].comparable).toBe(false);
 d.readings[1].unit="kg";expect(compareTests(d,a.id,b.id,"Physicality",today,30).every(r=>!r.comparable)).toBe(true);
 expect(coachingValue(75,"height","in")).toBe("6′ 3″");
});
const qpa=(id:string,snapshot="fictional-snapshot"):SharedGameStat[]=>Object.entries({pa:10,ab:8,base_hit:4,bb:1,hbp:0,sac_fly:1,punchies:2,pumps:1,sb:1,gdp:0}).map(([metric,value])=>({source:"qpa_fall_2026",athlete_id:id,metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:snapshot,fetched_at:"2026-09-13T01:00:00Z",content_hash:"a".repeat(64)}));
it("game comparisons require same snapshot and show correct opportunity denominators",()=>{
 const d=data([]);d.games=coachingGames([...qpa(a.id),...qpa(b.id)]);
 const avg=compareGames(d,a.id,b.id,"").find(r=>r.metric==="batting_avg");expect(avg).toMatchObject({comparable:true,first:{value:.5,opportunities:8}});
 const obp=compareGames(d,a.id,b.id,"").find(r=>r.metric==="batting_obp");expect(obp).toMatchObject({first:{value:.5,opportunities:10}});
 d.games=coachingGames([...qpa(a.id),...qpa(b.id,"stale")]);expect(compareGames(d,a.id,b.id,"").every(r=>!r.comparable)).toBe(true);
 expect(JSON.stringify(d.games)).not.toContain("content_hash");expect(JSON.stringify(d.games)).not.toContain("source_row");
});
it("pitching comparisons retain actual event boundaries and do not choose a different player's latest game",()=>{
 const pitch=(id:string,event:string,date:string):SharedGameStat[]=>qpa(id).slice(0,2).map((r,i)=>({...r,source:"pitching_fall_2026",scope:"pitching_event",event_id:event,played_on:date,metric:i===0?"strike_pct":"pitches",value:i===0?60:20,unit:i===0?"%":"count"}));
 const d=data([]);d.games=coachingGames([...pitch(a.id,"one","2026-09-12"),...pitch(a.id,"two",today),...pitch(b.id,"one","2026-09-12")]);
 expect(compareGames(d,a.id,b.id,"one")[0]).toMatchObject({comparable:true,first:{opportunities:20}});
 expect(compareGames(d,a.id,b.id,"two")[0].comparable).toBe(false);
});
it("renders linked names, neutral first tests, readable comparison values and meaningful empty states",()=>{
 const d=data([reading(150,"2026-08-01"),reading(156,today),reading(145,today,{athleteId:b.id})]);
 const html=renderToStaticMarkup(createElement(TeamProgress,{data:d,today}));expect(html).toContain("+4.0%");expect(html).toContain("First Test");expect(html).toContain(`/athletes/${a.id}`);
 const comparison=renderToStaticMarkup(createElement(PlayerComparison,{data:d,today}));expect(comparison).toContain("156 lb");expect(comparison).toContain("145 lb");expect(comparison).toContain('aria-haspopup="dialog"');expect(comparison).toContain('>Player A</span>');
 const empty=renderToStaticMarkup(createElement(TeamProgress,{data:data([]),today}));expect(empty).toContain("Ready for");expect(empty).toContain("Information Imports");
});

it("searches the full supplied roster without requiring measurements or exact display labels",()=>{
 const players=[a,b,{...a,id:"fictional-c",name:"Example José North",code:"SYN-003"}];
 expect(filterComparisonPlayers(players,"")).toHaveLength(3);
 expect(filterComparisonPlayers(players,"jose north").map(p=>p.id)).toEqual(["fictional-c"]);
 expect(filterComparisonPlayers(players,"SYN-002").map(p=>p.id)).toEqual([b.id]);
 expect(filterComparisonPlayers(players,"missing")).toEqual([]);
 const html=renderToStaticMarkup(createElement(PlayerComparison,{data:{players,readings:[],games:[]},today}));
 expect(html).toContain(a.name);expect(html).toContain(b.name);expect(html).toContain("No recorded");
});
