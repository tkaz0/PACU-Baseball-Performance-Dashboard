import {expect,it} from "vitest";
import {cumulativePitching,PITCHING_CUMULATIVE} from "@/lib/pitching-cumulative";
import {pitchingRates,pitchingContactRates,pitchSplits} from "@/lib/pitching-stats";
import {playerGameSources,compareGames, type CoachingData} from "@/lib/coaching-tools";
import type {SharedGameStat} from "@/lib/game-server";
const rows=(week:number,counts:Record<string,number>):SharedGameStat[]=>Object.entries(counts).map(([metric,value])=>({athlete_id:"fictional",source:"pitching_fall_2026",metric,value,unit:"count",scope:"pitching_event",event_id:`fall-2026-week-${week}`,played_on:null,source_row:40,source_column:1,derived_from:[],snapshot_id:"fictional",fetched_at:"2026-09-15T02:00:00Z",content_hash:"a".repeat(64)}));
it("sums counts from one snapshot and recomputes weighted rates, not average rates",()=>{
 const raw=[...rows(1,{innings_outs:3,k:1,bb_outcome:0,r:2,pitches:10,strikes:8,weak_contact:1,hard_contact:1,fb:8,fb_k:7}),...rows(2,{innings_outs:6,k:3,bb_outcome:2,r:1,pitches:30,strikes:12,weak_contact:7,hard_contact:1,fb:12,fb_k:5})];
 const c=cumulativePitching(raw);expect(c.every(r=>r.event_id===PITCHING_CUMULATIVE&&r.played_on===null)).toBe(true);expect(c.find(r=>r.metric==="strike_pct")?.value).toBe(50);
 expect(pitchingRates(c).map(r=>r.value)).toEqual([12,6,9]);expect(pitchingContactRates(c).map(r=>r.value)).toEqual([80,20]);expect(pitchSplits(c)[0].strikePct).toBe(60);
 expect(raw[0].event_id).toBe("fall-2026-week-1");
});
it("withholds incomplete counts and rejects duplicates, mixed snapshots, and overlapping series",()=>{
 const a=rows(1,{k:2,innings_outs:3}),b=rows(2,{innings_outs:3});expect(cumulativePitching([...a,...b]).some(r=>r.metric==="k")).toBe(false);
 expect(cumulativePitching([...a,a[0]])).toEqual([]);expect(cumulativePitching([...a,...b.map(r=>({...r,snapshot_id:"other"}))])).toEqual([]);
 expect(cumulativePitching([...a,...b.map(r=>({...r,event_id:"dated",played_on:"2026-09-15"}))])).toEqual([]);
});
it("uses roster roles for game source choices and rejects comparisons across unmatched roles",()=>{
 const base={id:"a",name:"Fictional A",code:"PAC-0001",academicClass:"Junior",bats:"R",throws:"R",position:"P",playerType:"pitcher"};
 expect(playerGameSources(base)).toEqual(["pitching_fall_2026"]);expect(playerGameSources({...base,position:"OF",playerType:"position"})).toEqual(["qpa_fall_2026"]);expect(playerGameSources({...base,playerType:"two_way"})).toHaveLength(2);
 const data:CoachingData={players:[base,{...base,id:"b",position:"OF",playerType:"position"}],readings:[],games:[]};expect(compareGames(data,"a","b",PITCHING_CUMULATIVE)).toEqual([]);
});
