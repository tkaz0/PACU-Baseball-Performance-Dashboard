import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { measurementChange, playerRenphoChange, renphoMeasurementChange, formatMeasurementChange } from "@/lib/measurement-change";
import { MeasurementChange } from "@/components/measurement-change";
import { getPlayerPerformance } from "@/lib/player-performance";
import type { Measurement } from "@/lib/imports/engine";
const previous = { athlete: "SYN-001", metric: "muscle_mass", source: "RENPHO", unit: "lb", date: "2026-09-06", value: 150 };
const current = { ...previous, date: "2026-09-13", value: 156 };
const raw = (id: string, date: string, value: number, metric = "Muscle Mass", unit = "lb"): Measurement => ({ id, athlete_code: "SYN-001", measured_at: date, value, metric, unit, source: "RENPHO", source_file: "fictional-report.png", source_sheet: "RENPHO report · Page 1", source_row: 1, file_hash: (id === "old" ? "a" : "b").repeat(64) });
it("computes relative percentage changes and retains prior value/date", () => {
  expect(measurementChange(current, [current, previous])).toEqual({ percent: 4, previousValue: 150, previousDate: "2026-09-06", difference: 6, unit: "lb", tone: "green" });
  expect(formatMeasurementChange(measurementChange(current, [previous])!)).toBe("+4.0%");
});
it("uses owner-approved body directions without changing neutral height/weight", () => {
  for (const metric of ["muscle_mass", "RENPHO Body Score"]) {
    expect(measurementChange({ ...current, metric }, [{ ...previous, metric }])?.tone).toBe("green");
    expect(measurementChange({ ...current, metric, value: 144 }, [{ ...previous, metric }])?.tone).toBe("red");
  }
  expect(measurementChange({ ...current, metric: "body_fat_pct", unit: "%", value: 18 }, [{ ...previous, metric: "body_fat_pct", unit: "%", value: 20 }])).toMatchObject({ percent: -10, difference: -2, tone: "green" });
  expect(measurementChange({ ...current, metric: "Body Fat Percentage", value: 22 }, [{ ...previous, metric: "Body Fat Percentage", value: 20 }])?.tone).toBe("red");
  for (const metric of ["height", "weight", "Bone Mass", "Visceral Fat"]) expect(measurementChange({ ...current, metric }, [{ ...previous, metric }])?.tone).toBe("neutral");
});
it("requires the exact athlete, source, metric and unit, with an earlier distinct date", () => {
  for (const replacement of [{ athlete: "SYN-002" }, { source: "Other scale" }, { metric: "Weight" }, { unit: "kg" }, { date: current.date }, { date: "2026-09-14" }, { date: "2026-02-30" }]) expect(measurementChange(current, [{ ...previous, ...replacement }])).toBeNull();
  expect(measurementChange(current, [])).toBeNull();
});
it("does not skip an ambiguous previous date or accept disagreeing current-day results", () => {
  expect(measurementChange(current, [previous, { ...previous, value: 149 }, { ...previous, date: "2026-08-01" }])).toBeNull();
  expect(measurementChange(current, [previous, { ...current, value: 155 }])).toBeNull();
  expect(measurementChange(current, [previous, { ...previous }])?.percent).toBe(4);
});
it("handles zero prior results, unchanged values and tiny movements honestly", () => {
  const zero = measurementChange(current, [{ ...previous, value: 0 }])!;
  expect(zero).toMatchObject({ percent: null, tone: "neutral" }); expect(formatMeasurementChange(zero)).toBe("No % comparison");
  const unchanged = measurementChange({ ...current, value: 150 }, [previous])!;
  expect(unchanged).toMatchObject({ percent: 0, tone: "neutral" }); expect(formatMeasurementChange(unchanged)).toBe("0.0%");
  expect(formatMeasurementChange(measurementChange({ ...current, value: 150.01 }, [previous])!)).toBe("+<0.1%");
});
it("uses the newest test date despite late uploads, and supports a previous summer report", () => {
  const readings = [raw("old", "2026-08-09", 150), raw("new", "2026-09-13", 156), raw("older", "2026-07-10", 148)];
  const model = getPlayerPerformance({ readings, athleteCode: "SYN-001", batches: [] });
  const card = model.body.find(c => c.metric.key === "muscle_mass")!;
  expect(card.latest?.value).toBe(156); expect(playerRenphoChange(card)).toMatchObject({ percent: 4, previousDate: "2026-08-09" });
  expect(card.latest?.period).toBe("fall_2026");
});
it("supports report breakdown changes and does not compare generic manual measurements", () => {
  const a = raw("old", "2026-09-06", 150), b = raw("new", "2026-09-13", 156);
  expect(renphoMeasurementChange(b, [a, b])?.percent).toBe(4);
  expect(renphoMeasurementChange({ ...b, source_sheet: "Manual" }, [a, b])).toBeNull();
  const card = getPlayerPerformance({ readings: [{ ...a, source_sheet: "Manual" }, { ...b, source_sheet: "Manual" }], athleteCode: "SYN-001" }).body.find(c => c.metric.key === "muscle_mass")!;
  expect(playerRenphoChange(card)).toBeNull();
});
it("renders accessible signed change and prior date, with percentage-point distinction", () => {
  const change = measurementChange({ ...current, metric: "body_fat_pct", unit: "%", value: 18 }, [{ ...previous, metric: "body_fat_pct", unit: "%", value: 20 }]);
  const html = renderToStaticMarkup(createElement(MeasurementChange, { change }));
  expect(html).toContain("−10.0%"); expect(html).toContain('data-tone="green"'); expect(html).toContain("2026-09-06"); expect(html).toContain("-2 percentage points");
  expect(renderToStaticMarkup(createElement(MeasurementChange, { change: null }))).toBe("");
});

it("formats the prior height in feet and inches without changing the comparison unit", () => {
  const change = measurementChange({ ...current, metric: "height", unit: "in", value: 72 }, [{ ...previous, metric: "height", unit: "in", value: 71 }]);
  const html = renderToStaticMarkup(createElement(MeasurementChange, { change, metric: "height" }));
  expect(html).toContain("5′ 11″"); expect(html).toContain('data-tone="neutral"');
});
