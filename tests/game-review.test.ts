import {expect,it} from "vitest";
import {reviewGameData,obpReadyCount} from "@/lib/game-review";
import type {SharedGameStat} from "@/lib/game-server";
const rows=(v:Record<string,number>):SharedGameStat[]=>Object.entries(v).map(([metric,value])=>({source:"qpa_fall_2026",athlete_id:"fictional",metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:8,source_column:2,derived_from:[],snapshot_id:"fictional",fetched_at:"2026-09-12T12:00:00Z",content_hash:"a".repeat(64)}));
const complete={pa:5,ab:4,base_hit:1,bb:1,hbp:0,sac_fly:0,sac_bunt:0,punchies:1,pumps:0,hh_base_hit:1,three_eight_hh:0,hh_extra_base_hit:0,qpa:2};
it("reports source-count conflicts once with a precise row link",()=>{const issues=reviewGameData(rows({...complete,ab:5,sac_fly:1,bb:0}),[]);expect(issues).toHaveLength(1);expect(issues[0]).toMatchObject({athleteId:"fictional",message:"AB + BB + HBP + Sac Fly exceeds PA."});expect(issues[0].href).toContain('range=A8:AC8');expect(obpReadyCount(rows({...complete,ab:5,sac_fly:1,bb:0}))).toBe(0);});
it("does not invent errors from complete zero counts or empty data",()=>{expect(reviewGameData(rows(complete),[])).toEqual([]);expect(obpReadyCount(rows(complete))).toBe(1);expect(reviewGameData([],[])).toEqual([]);});
it("flags missing rate inputs and impossible hard-hit totals",()=>{expect(reviewGameData(rows({ab:4}),[]).some(i=>i.message.includes("Missing counts"))).toBe(true);expect(reviewGameData(rows({...complete,hh_base_hit:5}),[]).some(i=>i.message.includes("Hard-hit"))).toBe(true);});
