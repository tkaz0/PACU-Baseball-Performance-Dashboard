import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/app/(workspace)/analytics/view-actions", () => ({ saveAnalyticsView: vi.fn(), archiveAnalyticsView: vi.fn() }));
import { AnalyticsExplorer } from "@/components/analytics-explorer";

it("puts accessible explanations beside both correlation scores even before results arrive", () => {
  const html = renderToStaticMarkup(createElement(AnalyticsExplorer, { data: { players: [], readings: [] } }));
  expect(html).toContain('aria-label="About Pearson r"');
  expect(html).toContain('aria-label="About R²"');
  expect(html).toContain("players shown");
  expect(html).toContain("trend line");
});

it("discloses Fall rollups and marks a latest-session average without relabeling it as a maximum",()=>{
 const base={athleteId:"fictional",source:"Full Swing · Intrasquad",unit:"mph",date:"2026-09-26",importedAt:"2026-10-04T12:00:00Z"};
 const readings=[{...base,id:"max",metric:"max_exit_velocity",label:"Max EV",value:105,basis:"fall-best" as const},{...base,id:"avg",metric:"avg_exit_velocity",label:"Average EV",value:78,basis:"latest-session" as const}];
 const html=renderToStaticMarkup(createElement(AnalyticsExplorer,{data:{players:[{id:"fictional",code:"SYN-001",name:"Fictional Player",position:"OF",academicClass:"freshman",playerType:"position",bats:"R",throws:"R"}],readings},initialX:JSON.stringify(["max_exit_velocity","mph","full swing · intrasquad"]),initialY:JSON.stringify(["avg_exit_velocity","mph","full swing · intrasquad"])}));
 expect(html).toContain("Latest Session");expect(html).toContain("reading-weighted averages");
 expect(html).toContain("Average EV (In Game)");expect(html).not.toContain("Most recent result for each stat");
});
