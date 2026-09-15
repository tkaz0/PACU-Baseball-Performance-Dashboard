import {describe,it,expect} from "vitest";
import {pitchingAnalytics} from "@/lib/game-analytics";
import {analyticsVariables} from "@/lib/analytics";
import type {SharedGameStat} from "@/lib/game-server";
const rows=(week=1):SharedGameStat[]=>Object.entries({innings_outs:5,r:2,k:3,bb_outcome:1,pitches:20,strike_pct:60,weak_contact:6,hard_contact:2,fb:10,fb_k:7}).map(([metric,value])=>({athlete_id:"fictional",source:"pitching_fall_2026",metric,value,unit:metric==="strike_pct"?"%":"count",scope:"pitching_event",event_id:`fall-2026-week-${week}`,played_on:null,source_row:40,source_column:1,derived_from:[],snapshot_id:"fictional",fetched_at:"2026-09-15T02:00:00Z",content_hash:"a".repeat(64)}));
describe("pitching Analytics",()=>{
 it("provides rates and splits with disclosed snapshot dates and no invented ERA",()=>{const result=pitchingAnalytics(rows());expect(result.find(r=>r.metric==="pitching_r9")?.value).toBe(10.8);expect(result.find(r=>r.metric==="hard_contact_pct")?.value).toBe(25);expect(result.find(r=>r.metric==="fb_strike_pct")?.value).toBe(70);expect(result.every(r=>r.date==="2026-09-14"&&r.source.includes("snapshot date"))).toBe(true);expect(result.some(r=>r.metric==="pitching_era")).toBe(false);});
 it("keeps weeks separate and rejects mixed snapshots or duplicate readings",()=>{const output=pitchingAnalytics([...rows(),...rows(2)]);expect(analyticsVariables(output).filter(v=>v.metric==="pitching_r9")).toHaveLength(2);expect(pitchingAnalytics([...rows(),rows()[0]])).toEqual([]);expect(pitchingAnalytics(rows().map((r,i)=>i? r:{...r,snapshot_id:"different"}))).toEqual([]);});
});
