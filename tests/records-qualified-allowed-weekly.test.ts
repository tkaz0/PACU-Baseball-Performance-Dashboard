import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { qualifiedGameCodes } from "@/lib/game-qualification";
import { teamRecord, teamRecordSelections } from "@/lib/team-records";
import { contactAllowedSummary, type AllowedContact } from "@/lib/contacts-allowed";
import { PitcherContactAllowed } from "@/components/pitcher-contact-allowed";
import { buildGraphicsCard, graphicsSocialCaption } from "@/lib/graphics-card";
import { renderGraphics } from "@/lib/graphics-renderer";
import type { GameLeaderboardRow } from "@/lib/game-metrics";
import type { LeaderboardComparison, LeaderboardRow } from "@/lib/leaderboards";
import type { GraphicsWeek } from "@/lib/graphics-data";

// Fictional fixtures only; no production data.
const gameRow = (code: string, metric: string, opportunities: number, source = "qpa_fall_2026"): GameLeaderboardRow => ({ metric, source, eventId: "", playedOn: null, value: 1, unit: "%", rank: 1, name: code, code, profileId: null, updatedAt: "2026-10-01T00:00:00Z", opportunities, percentile: null, sampleSize: 5 });

describe("qualified game leaderboards", () => {
  it("uses 2 PA per week for hitters and 1 IP per week for pitchers", () => {
    const hitting = qualifiedGameCodes([gameRow("SYN-1", "qpa_pct", 4), gameRow("SYN-2", "qpa_pct", 3), gameRow("SYN-2", "batting_avg", 9)], "hitting", 2);
    expect([...hitting.codes]).toEqual(["SYN-1"]); expect(hitting.label).toBe("4 PA");
    const pitching = qualifiedGameCodes([gameRow("SYN-3", "pitching_whip", 6, "pitching_fall_2026"), gameRow("SYN-4", "pitching_whip", 5, "pitching_fall_2026")], "pitching", 2);
    expect([...pitching.codes]).toEqual(["SYN-3"]); expect(pitching.label).toBe("2 IP");
  });
});

describe("team records", () => {
  const comparisons: LeaderboardComparison[] = [
    { metricKey: "max_exit_velocity", source: "full swing · intrasquad", unit: "mph", period: "fall_2026", athleteCount: 6 },
    { metricKey: "weight", source: "renpho", unit: "lb", period: "fall_2026", athleteCount: 6 },
  ];
  it("keeps directional boards and leaves neutral body measurements out", () => {
    const keys = teamRecordSelections(comparisons).map(item => item.comparison.metricKey);
    expect(keys).toContain("max_exit_velocity"); expect(keys).not.toContain("weight");
  });
  it("lists every tied #1 holder", () => {
    const row = (code: string, rank: number, value: number): LeaderboardRow => ({ rank, athleteCode: code, name: `Fictional ${code}`, jerseyNumber: null, position: null, profileId: null, value, measuredAt: "2026-09-26", source: "full swing · intrasquad", derived: false });
    const record = teamRecord(comparisons[0], "Hitting · In-Game", [row("A", 1, 101.2), row("B", 1, 101.2), row("C", 3, 99)])!;
    expect(record.holders.map(h => h.code)).toEqual(["A", "B"]); expect(record.value).toBe("101.2 mph"); expect(record.players).toBe(3);
  });
});

describe("contact allowed", () => {
  const c = (ev: number, angle: number, direction: number | null = 0, sq: number | null = .8): AllowedContact => ({ playedOn: "2026-09-26", category: "intrasquad", exitVelocity: ev, launchAngle: angle, direction, distance: null, squaredUp: sq });
  it("summarizes batted balls against and leaves likely fouls out", () => {
    const s = contactAllowedSummary([c(95, 5), c(80, 15), c(60, 30, 60), c(70, 60, 0, null)]);
    expect(s.count).toBe(3); expect(s.fouls).toBe(1);
    expect(s.hardHitPct).toBeCloseTo(100 / 3); expect(s.groundPct).toBeCloseTo(100 / 3); expect(s.popupPct).toBeCloseTo(100 / 3);
    expect(s.squaredCount).toBe(2);
    const html = renderToStaticMarkup(createElement(PitcherContactAllowed, { contacts: [c(95, 5)] }));
    expect(html).toContain("Contact Allowed"); expect(html).toContain("95.0 mph");
  });
  it("renders nothing without linked contact", () => {
    expect(renderToStaticMarkup(createElement(PitcherContactAllowed, { contacts: [] }))).toBe("");
  });
});

describe("players of the week graphic", () => {
  const week: GraphicsWeek = { week: 2, label: "Week 2", date: "September 26th",
    hitting: { name: "Fictional Hitter", headlineValue: "231", headlineLabel: "PAC Production+", stats: [{ label: "QPA%", value: "100.0%" }, { label: "OBP", value: ".833" }, { label: "ISO", value: ".333" }], sample: "6 PA", early: true, tied: false },
    pitching: { name: "Fictional Pitcher", headlineValue: "1.00", headlineLabel: "WHIP", stats: [{ label: "K/BB", value: "1.50" }, { label: "Runs/9", value: "0.00" }], sample: "2.0 IP", early: false, tied: false } };
  it("builds a two-tile card that renders in every post size without codes", () => {
    const card = buildGraphicsCard({ template: "weekly", player: null, second: null, metrics: [], board: null, topCount: 5, arsenalContext: "", trendKey: "", headline: "", week })!;
    expect(card.kicker).toBe("Fall Ball · Week 2 · September 26th");
    for (const format of ["square", "portrait", "story", "landscape"] as const) {
      const svg = renderGraphics(card, { format, theme: "black" });
      expect(svg).toContain("Fictional Hitter"); expect(svg).toContain("Fictional Pitcher"); expect(svg).not.toMatch(/SYN-|PAC-\d/);
    }
    expect(graphicsSocialCaption(card)).toContain("Hitter of the Week: Fictional Hitter");
  });
});
