import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { battingPowerRates,battingAdvancedRates,productionComparisons,pitchingExtraRates } from "@/lib/advanced-game-stats";
import { teamGameSummary } from "@/lib/team-game-stats";
import { coachingGames,coachingValue } from "@/lib/coaching-tools";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { gameOpportunities } from "@/lib/game-opportunities";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import type { SharedGameStat } from "@/lib/game-server";
const rows=(v:Record<string,number>,id="fictional-a",pitch=false):SharedGameStat[]=>Object.entries(v).map(([metric,value])=>({source:pitch?"pitching_fall_2026":"qpa_fall_2026",athlete_id:id,metric,value,unit:"count",scope:pitch?"pitching_event":"cumulative_fall",event_id:pitch?"fall-2026-week-1":null,played_on:null,source_row:2,source_column:2,derived_from:[],snapshot_id:"fictional-snapshot",fetched_at:"2026-09-28T01:00:00Z",content_hash:"a".repeat(64)}));
const line={pa:13,ab:10,base_hit:4,hh_extra_base_hit:2,pumps:1,bb:1,hbp:1,sac_fly:1,punchies:3};
it("counts singles once, all double/triple extra bases once and every home run as four",()=>{
 const result=battingPowerRates(rows(line));
 expect(result.find(r=>r.metric==="batting_est_slg")).toMatchObject({value:.9,opportunities:10});
 expect(result.find(r=>r.metric==="batting_est_iso")?.value).toBe(.5);
 expect(result.find(r=>r.metric==="batting_est_wobacon")).toMatchObject({opportunities:8});
 expect(result.find(r=>r.metric==="batting_est_wobacon")?.value).toBeCloseTo((.882+2*1.252+2.037)/8,12);
 expect(battingPowerRates(rows({...line,ab:1,pa:1,base_hit:1,hh_extra_base_hit:0,pumps:1,punchies:0,sac_fly:0})).find(r=>r.metric==="batting_est_slg")?.value).toBe(4);
});
it("withholds impossible or missing counts without changing valid traditional stats",()=>{
 for(const v of [{...line,hh_extra_base_hit:4},{...line,base_hit:11},{...line,ab:0},{...line,hh_extra_base_hit:-1},{...line,hh_extra_base_hit:.5}])expect(battingPowerRates(rows(v))).toEqual([]);
 const missing=rows(line).filter(r=>r.metric!=="hh_extra_base_hit");expect(battingPowerRates(missing)).toEqual([]);
 for(const v of [{...line,punchies:7},{...line,punchies:NaN}])expect(battingPowerRates(rows(v)).some(r=>r.metric==="batting_est_wobacon")).toBe(false);
 const allZero=Object.fromEntries(Object.keys(line).map(k=>[k,0]));expect(battingPowerRates(rows(allZero))).toEqual([]);
 for(const key of ["athlete_id","snapshot_id","event_id"]){const bad=rows(line).map((r,i)=>i===0?{...r,[key]:"other"}:r);expect(battingPowerRates(bad)).toEqual([]);}
 expect(battingPowerRates([...rows(line),rows(line)[0]])).toEqual([]);
});
it("pools production by PA, requires five valid same-snapshot lines and binds player index to current evidence",()=>{
 const source=[...rows(line),...rows({...line,pa:22,ab:20,base_hit:10,hh_extra_base_hit:3,pumps:2,bb:1,hbp:0},"fictional-b"),...["c","d","e"].flatMap(id=>rows({...line,pa:5,ab:5,base_hit:1,hh_extra_base_hit:0,pumps:0,bb:0,hbp:0,sac_fly:0,punchies:1},`fictional-${id}`))];
 const c=productionComparisons(source),own=c.get("fictional-a")!;
 expect(own.value).toBeCloseTo(100*(11/13)/(34/50),12);
 const counts=new Map(source.filter(r=>r.metric==="pa").map(r=>[r.athlete_id,r.value]));
 expect([...c].reduce((n,[id,r])=>n+r.value*counts.get(id)!,0)/50).toBeCloseTo(100,12);
 expect(battingAdvancedRates(rows(line),[own])[0].metric).toBe("batting_production_plus");
 expect(battingAdvancedRates(rows(line),[{...own,snapshotId:"old"}]).some(r=>r.unit==="index")).toBe(false);
 expect(productionComparisons(source.filter(r=>r.athlete_id!=="fictional-e")).size).toBe(0);
 expect(productionComparisons(source.map((r,i)=>i===0?{...r,snapshot_id:"old"}:r)).size).toBe(0);
 expect(productionComparisons(source.map(r=>r.metric==="pa"&&r.athlete_id==="fictional-a"?{...r,value:10}:r)).size).toBe(0);
 expect(coachingGames([...source,...rows({...line,base_hit:10,hh_extra_base_hit:8,pumps:2},"fictional-ineligible")],source).find(r=>r.athleteId==="fictional-a"&&r.metric==="batting_production_plus")?.value).toBeCloseTo(own.value,12);
 expect(coachingGames(source).find(r=>r.athleteId==="fictional-a"&&r.metric==="batting_production_plus")?.value).toBeCloseTo(own.value,12);
});
it("uses true outs and outcome walks for WHIP and K/BB, never HBP or pitch-family counts",()=>{
 const source=rows({innings_outs:5,h:2,bb_outcome:1,k:3,hbp:9,bb_pitch_family:20},"fictional-a",true);
 expect(pitchingExtraRates(source).map(r=>r.value)).toEqual([1.8,3]);
 expect(pitchingExtraRates(rows({innings_outs:5,h:2,bb_outcome:0,k:3},"fictional-a",true)).map(r=>r.metric)).toEqual(["pitching_whip"]);
 expect(pitchingExtraRates(rows({innings_outs:0,h:2,bb_outcome:1,k:3},"fictional-a",true)).map(r=>r.metric)).toEqual(["pitching_k_bb"]);
 expect(pitchingExtraRates(source.filter(r=>r.metric!=="bb_outcome"))).toEqual([]);
 const second=rows({innings_outs:4,h:1,bb_outcome:2,k:1},"fictional-a",true).map(r=>({...r,event_id:"fall-2026-week-2"}));
 const cumulative=cumulativePitching([...source,...second]);expect(pitchingExtraRates(cumulative).map(r=>r.value)).toEqual([2,4/3]);
 expect(gameOpportunities(cumulative,"pitching_fall_2026","pitching_whip","fall-2026-cumulative")).toBe(9);
});
it("team estimates pool valid numerators/denominators rather than player rate averages",()=>{
 const combined=[...rows(line),...rows({...line,ab:20,pa:23},"fictional-b")];
 const team=teamGameSummary(combined,"qpa_fall_2026");
 expect(team.rates.find(r=>r.metric==="batting_est_slg")?.value).toBe(18/30);
 expect(team.rates.find(r=>r.metric==="batting_est_wobacon")?.value).toBeCloseTo(2*(.882+2*1.252+2.037)/26,12);
 expect(gameOpportunities(rows(line),"qpa_fall_2026","batting_est_wobacon")).toBe(8);
});
it("labels estimates, shows chances, preserves unclipped power and formats comparison results",()=>{
 const html=renderToStaticMarkup(createElement(AthleteGameStats,{stats:rows(line)}));
 for(const label of ["SLG","ISO","wOBAcon","8 contacts","10 AB","count doubles/triples as doubles"])expect(html).toContain(label);
 expect(html).not.toContain(".900, on a 0 to 1.000");
 expect(coachingValue(123.55,"batting_production_plus","index")).toBe("124");expect(coachingValue(1.8,"pitching_whip","decimal")).toBe("1.80");
});
