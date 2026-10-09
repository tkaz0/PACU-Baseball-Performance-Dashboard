import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { battingRates } from "@/lib/batting-stats";
import { teamGameSummary, type TeamGameSummary } from "@/lib/team-game-stats";
import { teamReportCard } from "@/lib/team-report-card";
import { TeamReportCard } from "@/components/team-report-card";
import { ReportCustomizer, ScoutsTake } from "@/components/report-customizer";
import type { SharedGameStat } from "@/lib/game-server";

// Fictional fixtures only; no production data.
const row = (athlete: string, metric: string, value: number): SharedGameStat => ({ source: "qpa_fall_2026", athlete_id: athlete, metric, value, unit: "count", scope: "cumulative_fall", event_id: null, played_on: null, source_row: 2, source_column: 1, derived_from: [], snapshot_id: "fictional-snapshot", fetched_at: "2026-10-01T00:00:00Z", content_hash: "fictional" });

describe("8+ Pitch PA %", () => {
  it("divides 8+ pitch appearances by PA for players and the pooled team", () => {
    const rates = battingRates([row("a", "pa", 20), row("a", "eight_plus_pitches", 5), row("a", "punchies", 2)]);
    expect(rates.find(r => r.metric === "batting_8plus_pct")?.value).toBe(25);
    const team = teamGameSummary([row("a", "pa", 20), row("a", "eight_plus_pitches", 5), row("b", "pa", 10), row("b", "eight_plus_pitches", 1)], "qpa_fall_2026");
    expect(team.rates.find(r => r.metric === "batting_8plus_pct")?.value).toBe(20);
  });
});

describe("team report card", () => {
  const summary = (rates: TeamGameSummary["rates"]): TeamGameSummary => ({ players: 10, entries: 10, games: 0, updatedAt: null, counts: [], rates });
  it("grades each area by the fifth of the 2025 NWC team distribution and skips pending rates", () => {
    const areas = teamReportCard(summary([
      { metric: "batting_obp", label: "OBP", value: .9, unit: "avg", pending: false },
      { metric: "batting_k_pct", label: "K %", value: 60, unit: "%", pending: false },
      { metric: "batting_bb_pct", label: "BB %", value: null, unit: "%", pending: true },
    ]), null);
    expect(areas.map(a => [a.key, a.grade])).toEqual([["offense", "A"], ["contact", "F"]]);
    const html = renderToStaticMarkup(createElement(TeamReportCard, { areas }));
    expect(html).toContain("Team Report Card"); expect(html).toContain("What&#x27;s Working"); expect(html).toContain("Focus Areas");
    expect(html).not.toMatch(/overall grade:/i);
  });
});

describe("custom player report", () => {
  it("offers block toggles and an unsaved Scout's Take", () => {
    const html = renderToStaticMarkup(createElement(ReportCustomizer, null, createElement("article", null, createElement(ScoutsTake))));
    expect(html).toContain("Include on the report"); expect(html).toContain("Scout&#x27;s Take"); expect(html).toContain("not saved");
    expect(html).toContain('data-block="note"');
  });
});
