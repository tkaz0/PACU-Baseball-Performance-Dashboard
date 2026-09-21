import { it,expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { blastFallSummary,BLAST_MAIN_KEYS } from "@/lib/blast-fall";
import { BLAST_HEADERS } from "@/lib/blast-metrics";
import { previewBlastPerformance } from "@/lib/imports/blast-performance";
import { selectTable } from "@/lib/imports/engine";
import { getPreviewRoster } from "@/lib/preview-roster";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { withoutWeeklyBlastCards } from "@/lib/player-profile-layout";
import { getPlayerPerformance } from "@/lib/player-performance";
import { BlastPracticeReports } from "@/components/blast-practice-reports";
const roster=getPreviewRoster(),p=roster[0];
function report(hash="a",start="2026-09-13",end="2026-09-20",count=10,speed=60,kind:"average"|"p95"="average") {
 return previewBlastPerformance({table:selectTable([BLAST_HEADERS,[p.first_name,p.last_name,String(count),String(speed),"18","12","3","80","10","-30",".150",".050","90","85","88","25"]],0),roster,file:{fileName:"fictional.csv",fileHash:hash.repeat(64),sheetName:"CSV"},kind,start,end}).rows;
}
it("weights cumulative Fall averages by swing count and keeps only the five main metrics",()=>{const summary=blastFallSummary([...report(),...report("b","2026-09-21","2026-09-27",30,80)])!;expect(summary.totalSwings).toBe(40);expect(summary.reportCount).toBe(2);expect(summary.metrics.map(m=>m.key)).toEqual(BLAST_MAIN_KEYS);expect(summary.metrics[0].average).toBe(75);expect(summary.metrics[4].average).toBe(-30);});
it("never adds the peak file's swings or combines weekly P95 values",()=>{const summary=blastFallSummary([...report(),...report("b","2026-09-21","2026-09-27",30,80),...report("c","2026-09-13","2026-09-20",10,72,"p95"),...report("d","2026-09-21","2026-09-27",30,89,"p95")])!;expect(summary.totalSwings).toBe(40);expect(summary.metrics[0]).toMatchObject({average:75,peak:89});expect(summary.peakPeriod).toEqual({start:"2026-09-21",end:"2026-09-27"});});
it("withholds overlapping or duplicate average reports instead of silently double counting",()=>{for(const rows of [[...report(),...report("b","2026-09-20","2026-09-27")],[...report(),...report("b")]]){const summary=blastFallSummary(rows)!;expect(summary.issues.length).toBeGreaterThan(0);expect(summary.totalSwings).toBeNull();expect(summary.metrics.every(m=>m.average===null)).toBe(true);}});
it("deduplicates an identical observation repeated in memory",()=>{const rows=report();expect(blastFallSummary([...rows,...rows])?.totalSwings).toBe(10);});
it("withholds only a metric missing from one period, preserving complete sample counts",()=>{const later=report("b","2026-09-21","2026-09-27").filter(r=>r.metric!=="Early Connection");const summary=blastFallSummary([...report(),...later])!;expect(summary.totalSwings).toBe(20);expect(summary.metrics.find(m=>m.key==="blast_early_connection")).toMatchObject({average:null,missingReports:1});expect(summary.metrics[0].average).toBe(60);});
it("requires valid counts and a single athlete",()=>{expect(blastFallSummary(report().filter(r=>r.unit!=="count"))?.totalSwings).toBeNull();const rows=report("b").map(r=>({...r,athlete_code:"SYN-999"}));expect(blastFallSummary([...report(),...rows])?.issues).toContain("multiple_players");});
it("does not substitute peak-only reports for Fall averages or pool other vendors",()=>{const rows=report("a",undefined,undefined,10,90,"p95");const summary=blastFallSummary([...rows,...report("b").map(r=>({...r,source:"Full Swing · Practice"}))])!;expect(summary.totalSwings).toBeNull();expect(summary.metrics[0]).toMatchObject({average:null,peak:90});});
it("labels bat speeds by source without relabeling canonical metrics",()=>{expect(profileMetricLabel("avg_bat_speed","Average Bat Speed","Full Swing · Intrasquad")).toBe("Average Bat Speed (In-Game)");expect(profileMetricLabel("max_bat_speed","Max Bat Speed","Full Swing · Practice")).toBe("Max Bat Speed (Practice)");expect(profileMetricLabel("weight","Weight","RENPHO")).toBe("Weight");});
it("replaces weekly Blast cards without hiding a separate in-game result",()=>{const readings=[...report(),{...report("b")[1],source:"Full Swing · Intrasquad"}];const model=withoutWeeklyBlastCards(getPlayerPerformance({readings,athleteCode:p.athlete_code}));const avg=model.hitting.find(c=>c.metric.key==="avg_bat_speed")!;expect(avg.latest?.source).toBe("Full Swing · Intrasquad");expect(avg.sourceCards).toHaveLength(1);});
it("renders only the requested metrics and clearly separates cumulative averages and weekly peaks",()=>{const html=renderToStaticMarkup(BlastPracticeReports({readings:[...report(),...report("b",undefined,undefined,10,72,"p95")]}));expect(html).toContain("Fall 2026 · Cumulative");expect(html).toContain("Bat Speed (Practice)");expect(html).toContain("Hand Speed");expect(html).toContain("Latest Week");expect(html).not.toContain("Rotational Acceleration");expect(html).not.toContain("Time to Contact");});
