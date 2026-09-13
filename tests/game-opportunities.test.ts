import {expect,it} from "vitest";
import {gameOpportunities,gameOpportunityLabel} from "@/lib/game-opportunities";
import type {SharedGameStat} from "@/lib/game-server";
const rows=(v:Record<string,number>,overrides:Partial<SharedGameStat>={}):SharedGameStat[]=>Object.entries(v).map(([metric,value])=>({source:"qpa_fall_2026",athlete_id:"fictional",snapshot_id:"snapshot",metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,source_row:2,source_column:2,derived_from:[],fetched_at:"2026-09-12T12:00:00Z",content_hash:"a".repeat(64),...overrides}));
it("uses each rate's denominator instead of displaying PA for everything",()=>{
 const data=rows({pa:24,ab:20,bb:2,hbp:0,sac_fly:1,punchies:4,sac_bunt:1});
 for(const [metric,n] of [["batting_avg",20],["batting_obp",23],["batting_hh_pct",15],["batting_hr_pct",24],["batting_bb_pct",24],["batting_k_pct",24],["qpa_pct",24],["sb",24]] as const)expect(gameOpportunities(data,"qpa_fall_2026",metric)).toBe(n);
 expect(gameOpportunityLabel("qpa_fall_2026","batting_obp")).toBe("OBP opportunities");
});
it("leaves missing or invalid opportunities absent",()=>{
 for(const data of [rows({ab:20}),rows({pa:0}),rows({pa:-1}),rows({pa:NaN}),rows({pa:2.5})])expect(gameOpportunities(data,"qpa_fall_2026","batting_hr_pct")).toBeNull();
 expect(gameOpportunities(rows({ab:3,bb:1,hbp:0}),"qpa_fall_2026","batting_obp")).toBeNull();
 expect(gameOpportunities(rows({ab:2,punchies:3,sac_bunt:0}),"qpa_fall_2026","batting_hh_pct")).toBeNull();
});
it("never combines players, snapshots, duplicate fields, or different pitching events",()=>{
 const data=rows({pa:20});for(const extra of [data[0],{...data[0],athlete_id:"other"},{...data[0],snapshot_id:"older"}])expect(gameOpportunities([...data,extra],"qpa_fall_2026","batting_hr_pct")).toBeNull();
 const pitching=[...rows({pitches:30},{source:"pitching_fall_2026",event_id:"game-one"}),...rows({pitches:55},{source:"pitching_fall_2026",event_id:"game-two"})];
 expect(gameOpportunities(pitching,"pitching_fall_2026","strike_pct","game-one")).toBe(30);
 expect(gameOpportunities(pitching,"pitching_fall_2026","strike_pct","game-two")).toBe(55);
 expect(gameOpportunityLabel("pitching_fall_2026","k")).toBeNull();
});
