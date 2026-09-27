import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getPlayerPerformance } from "@/lib/player-performance";
import { profileOverviewGroups } from "@/lib/profile-overview-groups";
import { physicalityRadarPoints } from "@/components/physicality-radar";
import { PlayerOverview } from "@/components/player-overview";
import type { Measurement } from "@/lib/imports/engine";

const reading = (source: string, value: number, date: string, code="SYN-001"): Measurement => ({ id:`fictional:${source}:${code}:${date}`,athlete_code:code,metric:"Average Bat Speed",value,unit:"mph",measured_at:date,source,source_file:"fictional.csv",source_sheet:"CSV",source_row:2,file_hash:"a".repeat(64) });

describe("source-separated profile comparison board", () => {
  it("keeps an earlier game reading visible beside a newer practice reading and does not average their values", () => {
    const performance=getPlayerPerformance({readings:[reading("Full Swing · Intrasquad",64.123,"2026-09-11"),reading("Full Swing · Hitting",71.987,"2026-09-23")],athleteCode:"SYN-001"});
    const groups=profileOverviewGroups(performance.hitting);
    expect(groups.map(g=>`${g.title}:${g.context}`)).toEqual(["Hitting:In-Game","Hitting:Practice"]);
    expect(groups.map(g=>g.cards[0].latest?.value)).toEqual([64.123,71.987]);
    const html=renderToStaticMarkup(createElement(PlayerOverview,{cards:performance.hitting}));
    expect(html).toContain('aria-label="Team Comparison Board"');
    expect(html).toContain('aria-label="Hitting · In-Game percentiles"');
    expect(html).toContain('aria-label="Hitting · Practice percentiles"');
    expect(html).toContain("64.1 mph");expect(html).toContain("72.0 mph");
    expect(html).not.toContain('role="meter"');
  });

  it("retains source-specific cohort ranks and deduplicates only the same metric/source/unit/period card", () => {
    const codes=Array.from({length:5},(_,i)=>`SYN-00${i+1}`);
    const readings=codes.flatMap((code,i)=>[reading("Full Swing · Intrasquad",64+i,"2026-09-11",code),reading("Full Swing · Hitting",76-i,"2026-09-23",code)]);
    const performance=getPlayerPerformance({readings,athleteCode:"SYN-001",cohortAthleteCodes:codes});
    const groups=profileOverviewGroups([...performance.hitting,...performance.hitting]);
    expect(groups).toHaveLength(2);expect(groups.every(group=>group.cards.length===1)).toBe(true);
    expect(groups.map(group=>group.cards[0].percentile?.value)).toEqual([0,100]);
    const html=renderToStaticMarkup(createElement(PlayerOverview,{cards:performance.hitting}));
    const game=html.split('aria-label="Hitting · In-Game percentiles"')[1].split('aria-label="Hitting · Practice percentiles"')[0];
    const practice=html.split('aria-label="Hitting · Practice percentiles"')[1];
    expect(game).toContain('aria-valuenow="0"');expect(game).not.toContain('aria-valuenow="100"');
    expect(practice).toContain('aria-valuenow="100"');
    expect(html).not.toContain("SYN-002");expect(html).not.toContain("fictional.csv");
  });

  it("keeps timed protocols in Athletic Testing and omits unrecorded cards and body metrics", () => {
    const performance=getPlayerPerformance({readings:[{...reading("Player Metrics",4.18,"2026-09-16"),metric:"Home to First",unit:"s"},{...reading("RENPHO",170,"2026-09-16"),metric:"Weight",unit:"lb"}],athleteCode:"SYN-001"});
    const groups=profileOverviewGroups(Object.values(performance).flat());
    expect(groups).toHaveLength(1);expect(groups[0]).toMatchObject({title:"Athletic Testing",context:"Testing"});
    expect(groups[0].cards.map(card=>card.metric.key)).toEqual(["home_to_first"]);
  });
});


it("does not label summer-only or mixed-period body percentiles as a Fall physicality radar", () => {
  const codes=Array.from({length:5},(_,i)=>`SYN-00${i+1}`);
  const data=codes.flatMap((code,i)=>[["Muscle Mass",145+i,"lb"],["RENPHO Body Score",80+i,"points"],["Body Fat Percentage",16+i,"%"]].map(([metric,value,unit])=>({...reading("RENPHO",Number(value),"2026-08-09",code),id:`${code}:${metric}`,metric:String(metric),unit:String(unit)})));
  const summer=getPlayerPerformance({readings:data,athleteCode:codes[0],cohortAthleteCodes:codes});
  expect(physicalityRadarPoints(summer.body)).toEqual([]);
  const html=renderToStaticMarkup(createElement(PlayerOverview,{cards:summer.body}));
  expect(html).not.toContain('aria-label="Physicality percentile radar"');
  expect(html).toContain('aria-label="Physicality percentiles"');
  expect(html).toContain('dateTime="2026-08-09"');
  const mixed=getPlayerPerformance({readings:data.map(r=>r.metric==="Muscle Mass"?{...r,measured_at:"2026-09-16"}:r),athleteCode:codes[0],cohortAthleteCodes:codes});
  expect(physicalityRadarPoints(mixed.body)).toHaveLength(1);
});
