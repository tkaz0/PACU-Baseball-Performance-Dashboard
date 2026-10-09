import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AwardBadges, SkillProfile } from "@/components/skill-profile";
import type { RankingRow } from "@/components/percentile-rankings";

// Fictional fixtures only; no production data.
const row = (metric: string, percentile: number, game = true, source = "qpa_fall_2026"): RankingRow => ({ key: `${metric}:${source}`, label: metric.toUpperCase(), value: "1", percentile, sampleSize: 8, metric, game, guide: { value: 1, unit: "avg", source } });

describe("skill profile radar", () => {
  it("draws a radar only with at least three verified axes and never a combined score", () => {
    expect(renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40)] }))).toBe("");
    const html = renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40), row("batting_est_iso", 90)] }));
    expect(html).toContain("Hitting skill profile");
    expect(html).not.toContain("Pitching skill profile");
    expect(html).toContain("not a combined score");
  });
  it("prefers the In-Game Full Swing reading over Practice for one axis", () => {
    const html = renderToStaticMarkup(createElement(SkillProfile, { rows: [row("qpa_pct", 60), row("batting_obp", 40),
      row("max_exit_velocity", 20, false, "Full Swing · Practice"), row("max_exit_velocity", 80, false, "Full Swing · Game")] }));
    expect(html).toContain("Max EV 80th percentile");
    expect(html).not.toContain("Max EV 20th");
  });
});

describe("award badges", () => {
  it("labels only the sole leader as Team best and 90th+ as Top 10%", () => {
    const html = renderToStaticMarkup(createElement(AwardBadges, { rows: [row("qpa_pct", 100), row("batting_obp", 92), row("batting_est_iso", 89.9)] }));
    expect(html).toContain("Team best · QPA_PCT");
    expect(html).toContain("Top 10% · BATTING_OBP");
    expect(html).not.toContain("BATTING_EST_ISO");
    expect(renderToStaticMarkup(createElement(AwardBadges, { rows: [row("qpa_pct", 50)] }))).toBe("");
  });
});

