import { describe, expect, it } from "vitest";
import { buildTrainingBlockSeries, defaultTrainingBlocks, summarizeTrainingBlock, trainingBlockChange, trainingBlockWindowError, type TrainingBlockSeries } from "@/lib/training-blocks";
import { blastSource } from "@/lib/blast-metrics";
import type { Measurement } from "@/lib/imports/engine";

// Fictional numerical fixtures only. No production player/report data.
const options = { athleteCode: "PAC-9999", showHitting: true, showPitching: true, today: "2026-10-15" };
const row = (id: string, metric: string, value: number, unit = "mph", date = "2026-09-15", source = "Full Swing · Practice", fileHash = id): Measurement => ({ id, athlete_code: options.athleteCode, metric, value, unit, measured_at: date, source, file_hash: fileHash, source_sheet: "Fictional CSV", source_file: "fictional.csv", source_row: 2 });
const window = { start: "2026-09-01", end: "2026-09-30" };
const blast = (id: string, start: string, end: string, speed: number, count: number) => [row(`${id}-v`, "Average Bat Speed", speed, "mph", end, blastSource("average", start, end), id), row(`${id}-n`, "Blast Swing Count", count, "count", end, blastSource("average", start, end), id)];
const pitch = (id: string, date: string, source: string, velocity: number, count: number, spinCount: number | null = count) => [
  row(`${id}-v`, "Pitch Type Average Velocity", velocity, "mph", date, source, id),
  row(`${id}-m`, "Pitch Type Max Velocity", velocity + 3, "mph", date, source, id),
  row(`${id}-n`, "Pitch Type Velocity Readings", count, "count", date, source, id),
  row(`${id}-s`, "Pitch Type Average Spin", velocity * 25, "rpm", date, source, id),
  ...(spinCount === null ? [] : [row(`${id}-sn`, "Pitch Type Spin Readings", spinCount, "count", date, source, id)]),
];
const get = (rows: Measurement[], key: string) => buildTrainingBlockSeries(rows, options).find(item => item.metricKey === key)!;
const sample = (reading: Measurement, count: number) => ({ observationId: reading.id, count, value: reading.value, measuredAt: reading.measured_at, source: reading.source, metricKey: "avg_exit_velocity", unit: reading.unit });

describe("training blocks use exact comparable source evidence", () => {
  it("weights complete nonoverlapping Blast weeks by actual swings and never adds P95", () => {
    const rows = [...blast("a", "2026-09-01", "2026-09-07", 50, 10), ...blast("b", "2026-09-08", "2026-09-14", 70, 30), row("p95", "Peak Bat Speed (95th)", 80, "mph", "2026-09-14", blastSource("p95", "2026-09-08", "2026-09-14"))];
    const series = get(rows, "avg_bat_speed");
    expect(series.points).toHaveLength(2);
    expect(summarizeTrainingBlock(series, window)).toMatchObject({ value: 65, samples: 40, sessions: 2, issue: null });
    expect(buildTrainingBlockSeries(rows, options).some(item => /95/.test(item.label))).toBe(false);
  });

  it("withholds partial and overlapping weekly reports without choosing convenient rows", () => {
    const series = get([...blast("a", "2026-09-01", "2026-09-07", 50, 10), ...blast("b", "2026-09-07", "2026-09-14", 70, 30)], "avg_bat_speed");
    expect(summarizeTrainingBlock(series, window)).toMatchObject({ value: null, issue: "overlapping_reports" });
    expect(summarizeTrainingBlock(series, { start: "2026-09-02", end: "2026-09-06" })).toMatchObject({ value: null, issue: "partial_report" });
  });

  it("does not omit an incomplete Blast week to calculate a convenient mean", () => {
    const first = blast("a", "2026-09-01", "2026-09-07", 50, 10);
    const second = blast("b", "2026-09-08", "2026-09-14", 70, 30).filter(item => item.metric === "Blast Swing Count");
    const series = get([...first, ...second], "avg_bat_speed");
    expect(summarizeTrainingBlock(series, window)).toMatchObject({ value: null, sessions: 2, issue: "missing_results" });
    expect(summarizeTrainingBlock(series, { start: "2026-09-01", end: "2026-09-07" })).toMatchObject({ value: 50, samples: 10, issue: null });
  });

  it("keeps game, intrasquad, practice, and each classified pitch separate", () => {
    const sources = ["Full Swing · Game · Four-Seam Fastball", "Full Swing · Intrasquad · Four-Seam Fastball", "Full Swing · Practice · Four-Seam Fastball", "Full Swing · Practice · Slider"];
    const result = buildTrainingBlockSeries(sources.flatMap((source, index) => pitch(`p${index}`, "2026-09-15", source, 70 + index, 10)), options);
    expect(result.filter(item => item.metricKey === "classified_avg_velocity").map(item => item.source).sort()).toEqual([...sources].sort());
    expect(result.filter(item => item.metricKey === "classified_avg_velocity").every(item => item.points.length === 1)).toBe(true);
  });

  it("uses separate velocity/spin sample counts and best maxima", () => {
    const source = "Full Swing · Practice · Slider";
    const rows = [...pitch("a", "2026-09-05", source, 60, 2, 1), ...pitch("b", "2026-09-20", source, 80, 6, 3)];
    expect(summarizeTrainingBlock(get(rows, "classified_avg_velocity"), window)).toMatchObject({ value: 75, samples: 8, sessions: 2 });
    expect(summarizeTrainingBlock(get(rows, "classified_avg_spin"), window)).toMatchObject({ value: 1875, samples: 4 });
    expect(summarizeTrainingBlock(get(rows, "classified_max_velocity"), window)).toMatchObject({ value: 83, samples: 8 });
    rows.pop();
    expect(summarizeTrainingBlock(get(rows, "classified_avg_spin"), window)).toMatchObject({ value: null, issue: "missing_counts" });
    expect(summarizeTrainingBlock(get(rows, "classified_avg_velocity"), window).value).toBe(75);
  });

  it("requires exact saved per-metric counts for Full Swing summary averages", () => {
    const rows = [row("a", "Average EV", 70), row("b", "Average EV", 90, "mph", "2026-09-20")];
    expect(summarizeTrainingBlock(get(rows, "avg_exit_velocity"), window)).toMatchObject({ value: null, issue: "missing_counts" });
    const series = buildTrainingBlockSeries(rows, { ...options, readingCounts: [sample(rows[0], 3), sample(rows[1], 1)] })[0];
    expect(summarizeTrainingBlock(series, window)).toMatchObject({ value: 75, samples: 4, sessions: 2 });
  });

  it("withholds a count fetched from a different republish of the same observation", () => {
    const rows = [row("a", "Average EV", 70), row("b", "Average EV", 90, "mph", "2026-09-20")];
    const stale = sample(rows[0], 3), valid = sample(rows[1], 1);
    for (const change of [{ value: 71 }, { measuredAt: "2026-09-16" }, { source: "Full Swing · Intrasquad" }, { metricKey: "avg_bat_speed" }, { unit: "km/h" }]) {
      const series = buildTrainingBlockSeries(rows, { ...options, readingCounts: [{ ...stale, ...change }, valid] })[0];
      expect(summarizeTrainingBlock(series, window)).toMatchObject({ value: null, samples: null, issue: "missing_counts" });
    }
    const matching = buildTrainingBlockSeries(rows, { ...options, readingCounts: [stale, valid] })[0];
    expect(summarizeTrainingBlock(matching, window)).toMatchObject({ value: 75, samples: 4, issue: null });
  });

  it("uses fastest raw time, actual trial average/count, and directional change", () => {
    const rows = [row("a", "Home to First", 4.5, "s", "2026-09-05", "Player Metrics", "same-file"), row("b", "Home to First", 4.7, "s", "2026-09-05", "Player Metrics", "same-file"), row("c", "Home to First", 4.2, "s", "2026-09-20", "Player Metrics")];
    const series = get(rows, "home_to_first");
    const a = summarizeTrainingBlock(series, { start: "2026-09-01", end: "2026-09-10" }), b = summarizeTrainingBlock(series, { start: "2026-09-11", end: "2026-09-30" });
    expect(a).toMatchObject({ value: 4.5, average: 4.6, samples: 2, sessions: 1 });
    expect(b).toMatchObject({ value: 4.2, average: 4.2, samples: 1 });
    expect(trainingBlockChange(series, a, b)?.tone).toBe("improved");
  });

  it("keeps physicality neutral and uses the last test in the selected block", () => {
    const rows = [row("a", "Weight", 180, "lb", "2026-09-05", "RENPHO"), row("b", "Weight", 185, "lb", "2026-09-20", "RENPHO")];
    const series = get(rows, "weight"), total = summarizeTrainingBlock(series, window);
    expect(total).toMatchObject({ value: 185, samples: 2, sessions: 2, lastDate: "2026-09-20" });
    expect(trainingBlockChange(series, { ...total, value: 180 }, total)?.tone).toBe("neutral");
    expect(summarizeTrainingBlock(get([...rows, { ...rows[1], id: "conflict", value: 186, file_hash: "another-file" }], "weight"), window)).toMatchObject({ value: null, issue: "conflict" });
  });

  it("deduplicates identical observations and withholds conflicting observations", () => {
    const rows = blast("a", "2026-09-01", "2026-09-07", 50, 10);
    expect(summarizeTrainingBlock(get([...rows, ...rows], "avg_bat_speed"), window)).toMatchObject({ value: 50, samples: 10 });
    expect(summarizeTrainingBlock(get([...rows, { ...rows[0], value: 51 }], "avg_bat_speed"), window)).toMatchObject({ value: null, issue: "conflict" });
    expect(summarizeTrainingBlock(get([...rows, { ...rows[0], id: "another" }], "avg_bat_speed"), window)).toMatchObject({ value: null, issue: "conflict" });
  });

  it("does not treat a repeated Full Swing file with conflicting dates as two sessions", () => {
    const rows = [row("a", "Max EV", 90, "mph", "2026-09-05", "Full Swing · Practice", "same-file"), row("b", "Max EV", 95, "mph", "2026-09-20", "Full Swing · Practice", "same-file")];
    expect(summarizeTrainingBlock(get(rows, "max_exit_velocity"), window)).toMatchObject({ value: null, issue: "conflict" });
  });

  it("preserves signed swing angles and excludes unsupported/cumulative/future observations", () => {
    const rows = [...blast("a", "2026-09-01", "2026-09-07", 50, 10), row("angle", "Vertical Bat Angle", -35, "deg", "2026-09-07", blastSource("average", "2026-09-01", "2026-09-07"), "a"), row("future", "Weight", 200, "lb", "2026-10-20", "RENPHO"), row("game", "Max EV", 90, "mph", "2026-09-20", "QPA Fall")];
    expect(summarizeTrainingBlock(get(rows, "blast_vertical_bat_angle"), window)).toMatchObject({ value: -35, samples: 10 });
    const result = buildTrainingBlockSeries(rows, options);
    expect(result.some(item => item.metricKey === "weight" || item.metricKey === "max_exit_velocity")).toBe(false);
  });

  it("requires selected athlete, source/unit boundaries, and role-visible metrics", () => {
    const rows = [row("a", "Weight", 180, "lb", "2026-09-05", "RENPHO"), row("b", "Weight", 80, "kg", "2026-09-05", "RENPHO"), { ...row("peer", "Weight", 250, "lb", "2026-09-05", "RENPHO"), athlete_code: "PAC-9998" }, row("run", "Home to First", 4.5, "s", "2026-09-05", "Player Metrics"), ...blast("c", "2026-09-01", "2026-09-07", 50, 10)];
    const result = buildTrainingBlockSeries(rows, { ...options, showHitting: false });
    expect(result).toHaveLength(2);
    expect(result.map(item => item.unit).sort()).toEqual(["kg", "lb"]);
    expect(JSON.stringify(result)).not.toContain("PAC-");
    expect(JSON.stringify(result)).not.toContain("file_hash");
    expect(JSON.stringify(result)).not.toContain("fictional.csv");
  });

  it("validates dates and requires chronologically separate nonoverlapping blocks", () => {
    const a = { start: "2026-09-01", end: "2026-09-15" };
    expect(trainingBlockWindowError(a, { start: "2026-09-15", end: "2026-09-30" })).toMatch(/after/);
    expect(trainingBlockWindowError(a, { start: "2026-09-16", end: "2026-09-30" })).toBeNull();
    expect(trainingBlockWindowError(a, { start: "2026-09-16", end: "2026-09-31" })).toMatch(/date/);
    expect(trainingBlockWindowError({ ...a, start: "2026-08-01" }, window)).toMatch(/Fall/);
  });

  it("defaults to a gap between complete weekly reports and leaves missing blocks empty", () => {
    const series = buildTrainingBlockSeries([...blast("a", "2026-09-01", "2026-09-07", 50, 10), ...blast("b", "2026-09-08", "2026-09-14", 70, 30)], options);
    const blocks = defaultTrainingBlocks(series);
    expect(blocks).toEqual([{ start: "2026-09-01", end: "2026-09-07" }, { start: "2026-09-08", end: "2026-09-14" }]);
    expect(summarizeTrainingBlock(series[0], { start: "2026-09-20", end: "2026-09-21" })).toMatchObject({ value: null, samples: null, issue: "empty" });
    expect(trainingBlockChange(series[0], summarizeTrainingBlock(series[0], blocks[0]), summarizeTrainingBlock(series[0], { start: "2026-09-20", end: "2026-09-21" }))).toBeNull();
  });

  it("never reports infinity when a baseline is zero", () => {
    const series = { ...get([row("a", "Max Distance", 0, "ft")], "max_distance"), direction: "higher" } as TrainingBlockSeries;
    const a = summarizeTrainingBlock(series, window), b = { ...a, value: 20 };
    expect(trainingBlockChange(series, a, b)).toMatchObject({ delta: 20, percent: null });
  });
});
