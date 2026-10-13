import { describe,expect,it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hittingProduction } from "@/lib/hitting-production";
import { HittingProductionChart } from "@/components/hitting-production";
import type { SharedGameStat } from "@/lib/game-server";

// Fictional fixtures only.
const counts={pa:12,ab:10,base_hit:4,hh_extra_base_hit:1,pumps:1,bb:1,hbp:0,sac_fly:1,punchies:2,sac_bunt:0};
const rows=(v:Record<string,number>=counts,id="fictional-a"):SharedGameStat[]=>Object.entries(v).map(([metric,value])=>({source:"qpa_fall_2026",athlete_id:id,metric,value,unit:"count",scope:"cumulative_fall",event_id:null,played_on:null,snapshot_id:"fictional-snapshot",content_hash:"a".repeat(64),fetched_at:"2026-10-13T04:00:00Z",source_row:2,source_column:2,derived_from:[]}));
describe("hitting production breakdown",()=>{
  it("reconciles singles, combined doubles/triples, HR and free passes to the existing numerator",()=>{
    const result=hittingProduction(rows())!;
    expect(result).toMatchObject({pa:12,total:9,rate:.75,players:1});
    expect(result.parts.map(p=>[p.count,p.weight,p.points])).toEqual([[2,1,2],[1,2,2],[1,4,4],[1,1,1]]);
    expect(result.parts.reduce((n,p)=>n+p.share,0)).toBeCloseTo(100);
    const html=renderToStaticMarkup(createElement(HittingProductionChart,{production:result}));
    expect(html).toContain("12 PA");expect(html).toContain("Free Passes");expect(html).toContain("not plate appearances or runs scored");
  });
  it("pools team counts instead of averaging rates and applies existing sacrifice-fly accounting",()=>{
    const adjusted={...counts,pa:13,ab:12};
    const own=hittingProduction(rows(adjusted))!;expect(own.rate).toBe(9/13);
    const team=hittingProduction([...rows(),...rows({...counts,pa:24,ab:22},"fictional-b")])!;
    expect(team).toMatchObject({pa:36,total:18,rate:.5,players:2});
  });
  it("withholds incomplete, duplicate, conflicting, wrong-unit and mixed-version production",()=>{
    const incomplete=rows().filter(r=>r.metric!=="hbp");
    expect(hittingProduction([...rows(),...incomplete.map(r=>({...r,athlete_id:"fictional-b"}))])).toBeNull();
    expect(hittingProduction([...rows(),rows()[0]])).toBeNull();
    expect(hittingProduction(rows({...counts,hh_extra_base_hit:5}))).toBeNull();
    expect(hittingProduction(rows({...counts,base_hit:10,punchies:2}))).toBeNull();
    expect(hittingProduction(rows().map((r,i)=>i===0?{...r,unit:"%"}:r))).toBeNull();
    expect(hittingProduction([...rows(),...rows(counts,"fictional-b").map(r=>({...r,snapshot_id:"other"}))])).toBeNull();
  });
  it("preserves true zero production and does not invent a bar or a percentage from zero",()=>{
    const result=hittingProduction(rows({pa:4,ab:4,base_hit:0,hh_extra_base_hit:0,pumps:0,bb:0,hbp:0,sac_fly:0}))!;
    expect(result.total).toBe(0);expect(result.parts.every(p=>p.share===0)).toBe(true);
    const html=renderToStaticMarkup(createElement(HittingProductionChart,{production:result}));
    expect(html).toContain("No hits or free passes");expect(html).not.toContain('role="img"');
    expect(hittingProduction([])).toBeNull();
  });
});
