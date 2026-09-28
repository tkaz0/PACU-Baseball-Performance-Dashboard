import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { leaderboardSourceLabel, pitchLeaderboardLabel, LEADERBOARD_METRICS } from "@/lib/leaderboards";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import { PitchArsenalChart } from "@/components/pitch-arsenal-chart";
import { fictionalComparisonPitch } from "./fixtures/comparison-arsenal";

it("changes only recognized Full Swing display suffixes, preserving exact source keys and context", () => {
  for (const category of ["Game", "Intrasquad", "Practice"]) {
    const source = `Full Swing · ${category} · Fastball`;
    expect(pitchSourceLabel(source)).toBe(`Full Swing · ${category} · Unspecified Pitch`);
    expect(classifiedPitchSource(source)).toEqual({ category, pitchType: "Fastball" });
    expect(pitchSourceLabel(`Full Swing · ${category} · Four-Seam Fastball`)).toBe(`Full Swing · ${category} · 4-Seam Fastball`);
    expect(pitchSourceLabel(`Full Swing · ${category} · Two-Seam Fastball`)).toBe(`Full Swing · ${category} · 2-Seam Fastball`);
  }
  for (const source of ["Pitching · Fastball", "Full Swing · Pitching", "Full Swing · Practice · Unknown Type", "Other Vendor · Game · Fastball"])
    expect(pitchSourceLabel(source)).toBe(source);
  expect(leaderboardSourceLabel("full swing · intrasquad · fastball")).toBe("Full Swing · Intrasquad · Unspecified Pitch");
  const metric = LEADERBOARD_METRICS.find(row => row.key === "classified_avg_velocity")!;
  expect(pitchLeaderboardLabel(metric, "full swing · practice · fastball")).toBe("Unspecified Pitch · Average Velocity");
});

it("keeps legacy, four-seam and two-seam results separate and visible in both arsenal charts", () => {
  const pitches = [fictionalComparisonPitch(), fictionalComparisonPitch({ source: "Full Swing · Intrasquad · Four-Seam Fastball", pitchType: "Four-Seam Fastball" }), fictionalComparisonPitch({ source: "Full Swing · Intrasquad · Two-Seam Fastball", pitchType: "Two-Seam Fastball" })];
  const original = structuredClone(pitches);
  const html = renderToStaticMarkup(createElement(PitchArsenalChart, { pitches }));
  for (const label of ["Unspecified Pitch", "4-Seam Fastball", "2-Seam Fastball"]) {
    expect(html).toContain(`<strong>${label}</strong>`);
    expect(html).toContain(`<span>${label}</span>`);
  }
  expect(html).not.toContain("<strong>Fastball</strong>");
  expect(html).toContain("120 classified pitches across 3 pitch types");
  expect(pitches).toEqual(original);
});
