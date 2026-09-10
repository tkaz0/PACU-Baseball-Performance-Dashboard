import type { RenphoChartReport } from "@/lib/renpho-charts";
import { MUSCLE_BALANCE_REVIEW_PERCENT, RENPHO_SEGMENTS } from "@/lib/renpho-segments";

export function getRenphoMuscleBalance(report: RenphoChartReport) {
  const read = (key: string) => {
    const label = RENPHO_SEGMENTS.find(segment => segment.key === key)?.label;
    const candidates = report.readings.filter(reading => reading.metric === label);
    if (candidates.length !== 1) return null;
    const value = candidates[0];
    return value.athlete_code === report.reference.athlete_code && value.file_hash === report.reference.file_hash
      && value.measured_at === report.reference.measured_at && value.source === "RENPHO"
      && /^RENPHO report · Page [1-9][0-9]*$/.test(value.source_sheet)
      && ["lb", "kg"].includes(value.unit) && Number.isFinite(value.value) && value.value > 0 ? value : null;
  };
  const pairs = (["arm", "leg"] as const).map(part => {
    const left = read(`left_${part}_muscle_mass`), right = read(`right_${part}_muscle_mass`);
    const comparable = !!left && !!right && left.unit === right.unit;
    // Symmetric relative difference, independent of which side is larger.
    const difference = comparable ? (1 - Math.min(left.value, right.value) / Math.max(left.value, right.value)) * 100 : null;
    return { part, left, right, difference, review: difference !== null && difference + 1e-10 >= MUSCLE_BALANCE_REVIEW_PERCENT };
  });
  return { date: report.reference.measured_at, pairs, trunk: read("trunk_muscle_mass") };
}
