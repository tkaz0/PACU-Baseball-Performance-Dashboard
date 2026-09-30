import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {groupPresets,buildGroupComparison} from "@/lib/group-comparison";
import {ComparisonWorkspace} from "@/components/comparison-workspace";
import {groupData,groupPlayers} from "./fixtures/group-comparison";
import {fictionalComparisonArsenalData as arsenal} from "./fixtures/comparison-arsenal";
const ids=groupPlayers.map(p=>p.id),today="2026-09-29";
it("selects whole positions including secondary positions, deduplicates, and separates two-way roles",()=>{
 const presets=groupPresets([...groupPlayers,groupPlayers[0]]);
 expect(presets.find(p=>p.id==="all")?.playerIds).toHaveLength(8);
 expect(presets.find(p=>p.id==="infield")?.playerIds).toContain(groupPlayers[3].id);
 expect(presets.find(p=>p.id==="hitters")?.playerIds).not.toContain(groupPlayers[5].id);
 expect(presets.find(p=>p.id==="hitters")?.playerIds).toContain(groupPlayers[6].id);
 expect(presets.find(p=>p.id==="pitchers")?.playerIds).toEqual([groupPlayers[5].id,groupPlayers[6].id]);
});
it("retains every selected player without a cap; missing or ineligible results are not zero",()=>{
 const result=buildGroupComparison(groupData,[...ids,ids[0],"unknown"],"Game Stats",today);
 expect(result.players).toHaveLength(8);expect(result.gameSources).toEqual(["qpa","pitching"]);
 const group=result.groups[0],avg=group.columns.find(c=>c.metric==="batting_avg")!;
 expect(avg.comparable).toBe(true);expect(group.rows[5].cells[avg.key]).toMatchObject({value:null,eligible:false});
 const large={...groupData,players:Array.from({length:75},(_,i)=>({...groupPlayers[0],id:`fictional-${i}`}))};
 expect(buildGroupComparison(large,large.players.map(p=>p.id),"Physicality",today).players).toHaveLength(75);
});
it("withholds leading highlights across different snapshots and duplicated results",()=>{
 const data=structuredClone(groupData);data.games[0].snapshotId="older";
 expect(buildGroupComparison(data,ids,"Game Stats",today).groups[0].columns.find(c=>c.metric==="batting_avg")?.comparable).toBe(false);
 data.games.push({...data.games[0]});
 const g=buildGroupComparison(data,ids,"Game Stats",today).groups[0],c=g.columns.find(c=>c.metric==="batting_avg")!;
 expect(g.rows[0].cells[c.key]).toMatchObject({value:null,review:true});expect(c.comparable).toBe(false);
});
it("keeps exact source/unit partitions, date windows, and neutral physicality",()=>{
 const data=structuredClone(groupData);data.readings[0].date="2026-09-01";
 const group=buildGroupComparison(data,ids,"Physicality",today,7).groups[0];
 expect(group.columns.find(c=>c.metric==="muscle_mass")).toMatchObject({direction:"neutral",comparable:false});
 const broad=buildGroupComparison(data,ids,"Physicality",today,30).groups[0];expect(broad.columns.find(c=>c.metric==="muscle_mass")?.comparable).toBe(true);
 data.readings.push({...data.readings[2],id:"different-source",source:"Full Swing · Practice"});
 expect(buildGroupComparison(data,ids,"Hitting",today).groups.map(g=>g.source)).toEqual(expect.arrayContaining(["Full Swing · Intrasquad","Full Swing · Practice"]));
});
it("shows each pitch with average and max velocity/spin; incompatible averages and spin never lead",()=>{
 const g=buildGroupComparison(arsenal,arsenal.players.map(p=>p.id),"Throwing",today).groups;
 expect(g).toHaveLength(5);
 expect(g.every(g=>g.columns.length===4)).toBe(true);
 expect(g.every(g=>g.columns.filter(c=>c.unit==="rpm").every(c=>c.direction==="neutral"))).toBe(true);
 expect(g.find(g=>g.source.includes("Practice"))?.columns.find(c=>c.metric==="classified_avg_velocity")?.comparable).toBe(false);
 expect(g.find(g=>g.source.endsWith("Curveball"))?.rows[1].cells.classified_avg_velocity.value).toBeNull();
 expect(g[0].rows[0].cells.classified_avg_velocity.sample).toContain("36 velocity readings");
});
it("keeps counting stats descriptive, actual samples visible, and all controls rendered",()=>{
 const g=buildGroupComparison(groupData,ids,"Game Stats",today).groups[0];
 expect(g.columns.find(c=>c.metric==="pumps")?.direction).toBe("neutral");
 expect(g.rows[0].cells[g.columns.find(c=>c.metric==="batting_avg")!.key].sample).toBe("12 AB");
 const html=renderToStaticMarkup(createElement(ComparisonWorkspace,{data:groupData,today}));
 expect(html).toContain("Group Comparison");expect(html).toContain("Side by Side");expect(html).toContain("Show Dates &amp; Details");expect(html).toContain("Group Best");expect(html).toContain("12 AB");expect(html).toContain("Example Stone");
});

it("drops unavailable saved columns after a roster change and falls back to current stats",async()=>{
 const {visibleGroupColumns}=await import("@/components/group-comparison");
 const group=buildGroupComparison(groupData,ids,"Game Stats",today).groups[0];
 expect(visibleGroupColumns(group,["removed-metric"])).toEqual(group.columns.slice(0,6).map(c=>c.key));
 expect(visibleGroupColumns(group,["removed-metric",group.columns[0].key])).toEqual([group.columns[0].key]);
});
