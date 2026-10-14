import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ExitMeetingHandout } from "@/components/exit-meeting-handout";
import type { ExitMeetingReport, ExitMeetingRow } from "@/lib/exit-meeting";
// Fictional player and numbers only.
const row = (label: string, value: string, metricKey: string, percentile: number | null, extra: Partial<ExitMeetingRow> = {}): ExitMeetingRow => ({ label, value, source: "QPA Fall Sheet", date: "2026-10-12", basis: "Updated snapshot", percentile, peers: percentile === null ? null : 12, sample: "20 PA", metricKey, ...extra });
const report = (): ExitMeetingReport => ({ format: "meeting", name: "Fictional Boxer", code: "PAC-9999", jersey: "#7", position: "SS", academicClass: "Junior", batsThrows: "Bats R / Throws R", season: "Fall 2026", generatedAt: "2026-10-14T12:00:00Z", lastTested: "2026-09-26", lastGameUpdate: "2026-10-12T20:00:00Z",
  strengths: [{ label: "OPS · Hitting", detail: ".950 · 12 teammates", percentile: 88 }], development: [{ label: "K% · Hitting", detail: "30.0% · 12 teammates", percentile: 18 }], jumps: [],
  sections: [
    { id: "physicality", title: "Physicality", subtitle: "", rows: [row("Weight", "190 lb", "weight", 60, { source: "RENPHO" }), row("Grip Strength", "120 lb", "grip_strength", 75, { source: "Manual" })] },
    { id: "game-qpa_fall_2026", title: "Game Stats · Hitting", subtitle: "", rows: [row("PAC Production+", "121", "batting_production_plus", 80), row("OPS", ".950", "batting_ops", 88), row("QPA %", "60.0%", "qpa_pct", 70), row("ISO", ".250", "batting_est_iso", 66), row("K %", "30.0%", "batting_k_pct", 18)] },
    { id: "weeks-qpa_fall_2026", title: "Week by Week · Hitting", subtitle: "", rows: [row("OPS", "1.100", "batting_ops", null, { trend: [{ date: "2026-09-12", value: .8 }, { date: "2026-09-26", value: .9 }, { date: "2026-10-10", value: 1.1 }] })] },
    { id: "hitting-in_game", title: "Hitting · In-Game", subtitle: "", rows: [row("Max EV", "101.2 mph", "max_exit_velocity", 92, { source: "Full Swing · Intrasquad" })] },
    { id: "contact-in_game", title: "Contact", subtitle: "", rows: [row("Squared Up", "78.0%", "squared_up", null, { source: "Full Swing" })] },
    { id: "batted-ball-in_game", title: "Batted Ball", subtitle: "", rows: [row("Ground Ball", "40.0%", "bb_ground", null, { sample: "4 of 10 balls" }), row("Line Drive", "30.0%", "bb_line", null, { sample: "3 of 10 balls" }), row("Fly Ball", "30.0%", "bb_fly", null, { sample: "3 of 10 balls" })] },
  ], missing: ["Movement screening"], notes: [] });
it("renders a two-page sheet with headline tiles, percentile bars, insights, week trends and talking points", () => {
  const html = renderToStaticMarkup(createElement(ExitMeetingHandout, { report: report(), meetingDate: "2026-10-20", talkingPoints: "Fictional talking point" }));
  expect(html.match(/<article/g)).toHaveLength(2);
  expect(html).toContain('aria-label="Front"'); expect(html).toContain('aria-label="Back"');
  expect(html).toContain("Fictional Boxer"); expect(html).toContain("Oct 20, 2026");
  expect(html).toContain("Where You Rank on the Team"); expect(html).toContain("Max EV");
  // Weight is a body measurement: shown as a value on the back, never ranked as a bar.
  expect(html.split("Where You Rank")[1].split("Strengths")[0]).not.toContain("Weight");
  expect(html).toContain("Grip Strength");
  expect(html).toContain("Fictional talking point"); expect(html).toContain("Winter Focus");
  expect(html).toContain("1.100 latest wk");
  // Hitters' fourth headline ring is ISO; batted-ball quality and launch mix appear on the back.
  expect(html.split("Where You Rank")[0]).toContain("ISO");
  expect(html).toContain("Batted Ball Quality"); expect(html).toContain("Squared Up"); expect(html).toContain("Ground Ball <b>40%</b>");
  expect(html).not.toContain("Fall Week by Week");
  expect(html).toContain("Still to add: Movement screening");
  expect(html).not.toContain("PAC-9999");
});
it("leaves writing lines when there are no talking points and skips the pitching panel for hitters", () => {
  const html = renderToStaticMarkup(createElement(ExitMeetingHandout, { report: report(), meetingDate: "2026-10-20", talkingPoints: "" }));
  expect(html).not.toContain(">Pitching<");
  expect(html).toContain("Coach Talking Points");
});
