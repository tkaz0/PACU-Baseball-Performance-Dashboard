import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { buildDataCoverage } from "@/lib/data-coverage";
import { DataCoverage } from "@/components/data-coverage";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { AnalyticsReading } from "@/lib/analytics";
const player: CoachingPlayer = { id: "fictional-1", code: "SYN-001", name: "Example Player", position: "OF", playerType: "position", academicClass: "Junior", bats: "R", throws: "R" };
const pitcher = { ...player, id: "fictional-2", code: "SYN-002", name: "Example Pitcher", position: "P", playerType: "pitcher" };
const today = "2026-09-13";
const reading = (patch: Partial<AnalyticsReading> = {}): AnalyticsReading => ({ id: "fictional-reading", athleteId: player.id, metric: "weight", label: "Weight", date: today, importedAt: `${today}T12:00:00Z`, source: "RENPHO", value: 180, unit: "lb", ...patch });
it("shows every supplied player without inventing tests, with role-specific metrics", () => {
  const result = buildDataCoverage([player, pitcher, { ...pitcher, id: "two-way", playerType: "two_way", secondaryPosition: "SS" }], [], today);
  expect(result.rows).toHaveLength(3);
  expect(result.rows.find(r => r.player.id === player.id)?.cells.renpho).toMatchObject({ status: "missing", recorded: 0, expected: 5 });
  expect(result.rows.find(r => r.player.id === pitcher.id)?.cells.hitting).toMatchObject({ status: "not_applicable", expected: 0 });
  expect(result.rows.find(r => r.player.id === "two-way")?.cells.hitting.expected).toBe(6);
  expect(result.rows.find(r => r.player.id === "two-way")?.cells.throwing.expected).toBe(7);
  expect(result.rows.find(r => r.player.id === player.id)?.cells.throwing.expected).toBe(1);
});
it("does not count prior, future, invalid, wrong-player, or manual body results as RENPHO coverage", () => {
  const readings = [reading({ date: "2026-08-31" }), reading({ date: "2026-09-14" }), reading({ date: "2026-09-31" }), reading({ date: "2027-01-01" }), reading({ source: "Manual Testing" }), reading({ athleteId: "other" }), reading({ unit: "%" }), reading({ value: NaN })];
  const result = buildDataCoverage([player], readings, today);
  expect(result.rows[0].cells.renpho).toMatchObject({ status: "missing", recorded: 0, latest: null });
  expect(() => buildDataCoverage([], [], "invalid")).toThrow();
});
it("counts unique main metrics, exposes partial detail and never serializes readings", () => {
  const readings = [reading(), reading({ id: "same-value" }), reading({ metric: "body_fat_pct", value: 20, unit: "%" })];
  const result = buildDataCoverage([player], readings, today);
  expect(result.rows[0].cells.renpho).toMatchObject({ status: "partial", recorded: 2, expected: 5, latest: today });
  expect(result.rows[0].cells.renpho.metrics.filter(m => m.status === "missing")).toHaveLength(3);
  expect(JSON.stringify(result)).not.toContain('"value"'); expect(JSON.stringify(result)).not.toContain("importedAt");
  const complete = buildDataCoverage([player], [...readings, reading({ metric: "height", value: 72, unit: "in" }), reading({ metric: "body_score", value: 80, unit: "points" }), reading({ metric: "muscle_mass", value: 140 })], today);
  expect(complete.rows[0].cells.renpho.status).toBe("recorded");
});
it("holds conflicting latest source/unit results for review without confusing distinct protocols", () => {
  const result = buildDataCoverage([player], [reading(), reading({ value: 181 }), reading({ date: "2026-09-01", value: 179 })], today);
  expect(result.rows[0].cells.renpho).toMatchObject({ status: "review", recorded: 0 });
  const separate = buildDataCoverage([player], [reading(), reading({ unit: "kg", value: 82 })], today);
  expect(separate.rows[0].cells.renpho).toMatchObject({ status: "partial", recorded: 1 });
  const resolved = buildDataCoverage([player], [reading({ date: "2026-09-01" }), reading({ date: "2026-09-01", value: 181 }), reading({ date: today, value: 182 })], today);
  expect(resolved.rows[0].cells.renpho.status).toBe("partial");
});
it("counts valid zero-valued pitching metrics and excludes speed from hitting coverage", () => {
  const data = buildDataCoverage([player, pitcher], [reading({ metric: "home_to_first", value: 4, unit: "s" }), reading({ athleteId: pitcher.id, metric: "bb_pct", value: 0, unit: "%", source: "Full Swing · Pitching" })], today);
  expect(data.rows.find(r => r.player.id === player.id)?.cells.hitting.recorded).toBe(0);
  expect(data.rows.find(r => r.player.id === pitcher.id)?.cells.throwing.recorded).toBe(1);
});
it("renders linked names, metric-level disclosure and honest empty coverage", () => {
  const html = renderToStaticMarkup(createElement(DataCoverage, { data: buildDataCoverage([player, pitcher], [reading()], today) }));
  expect(html).toContain(`/athletes/${player.id}`); expect(html).toContain("Not applicable"); expect(html).toContain("Partial"); expect(html).toContain("1/5 metrics"); expect(html).toContain("Missing or partial results");
  const empty = renderToStaticMarkup(createElement(DataCoverage, { data: buildDataCoverage([], [], today) }));
  expect(empty).toContain("players are added"); expect(empty).not.toContain("NaN");
});
