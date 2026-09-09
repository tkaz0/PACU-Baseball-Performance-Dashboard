import type { LeaderboardComparison, LeaderboardRow } from "@/lib/leaderboards";

export const PHYSICALITY_COMPONENTS = ["height", "muscle_mass", "body_fat_pct"] as const;
export type PhysicalityComponent = (typeof PHYSICALITY_COMPONENTS)[number];
export type PhysicalityPanel = { comparison: LeaderboardComparison; rows: LeaderboardRow[] };
export type PhysicalityScore = LeaderboardRow & { components: Record<PhysicalityComponent, number> };
export type PhysicalityComposite = {
  rows: PhysicalityScore[]; sampleSize: number; excludedCount: number;
  source: string; period: "fall_2026"; heightUnit: string; muscleUnit: string;
};
export const PHYSICALITY_METHOD = "Version 1: equal-weight average of team percentiles for height (taller), total muscle mass (higher), and body fat % (lower). All three latest readings must share a test date and source within Fall 2026. At least five players with complete measurements are required. Percentiles use only that complete cohort; ties share their midpoint. The final average is rounded to one decimal, and equal scores share a rank. This is a descriptive team comparison, not a health rating or validated predictor of baseball performance. Scores can change when the comparison cohort changes, even without a new test.";

/** Pure derivation from the existing, authorized team leaderboard projection. */
export function physicalityComposite(panels: readonly PhysicalityPanel[]): PhysicalityComposite {
  const candidates: PhysicalityComposite[] = [];
  const options = panels.filter(p => p.comparison.period === "fall_2026");
  for (const height of options.filter(p => p.comparison.metricKey === "height")) {
    for (const muscle of options.filter(p => p.comparison.metricKey === "muscle_mass" && p.comparison.source === height.comparison.source)) {
      const fat = options.find(p => p.comparison.metricKey === "body_fat_pct" && p.comparison.source === height.comparison.source && p.comparison.unit === "%");
      if (!fat) continue;
      const mm = new Map(muscle.rows.map(r => [r.athleteCode, r])), fm = new Map(fat.rows.map(r => [r.athleteCode, r]));
      const complete = height.rows.flatMap(h => {
        const m = mm.get(h.athleteCode), f = fm.get(h.athleteCode);
        if (!m || !f || h.measuredAt !== m.measuredAt || h.measuredAt !== f.measuredAt || ![h.value, m.value, f.value].every(Number.isFinite)) return [];
        return [{ row: h, values: { height: h.value, muscle_mass: m.value, body_fat_pct: f.value } }];
      });
      const n = complete.length;
      const rows: PhysicalityScore[] = n < 5 ? [] : complete.map(({ row, values }) => {
        const components = Object.fromEntries(PHYSICALITY_COMPONENTS.map(key => {
          const better = (v: number) => key === "body_fat_pct" ? v > values[key] : v < values[key];
          const below = complete.filter(p => better(p.values[key])).length;
          const equal = complete.filter(p => p.values[key] === values[key]).length;
          return [key, 100 * (below + (equal - 1) / 2) / (n - 1)];
        })) as Record<PhysicalityComponent, number>;
        return { ...row, value: Math.round(PHYSICALITY_COMPONENTS.reduce((sum, k) => sum + components[k], 0) / 3 * 10) / 10, components, derived: true };
      });
      rows.sort((a, b) => b.value - a.value || a.athleteCode.localeCompare(b.athleteCode));
      rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].value === r.value ? rows[i - 1].rank : i + 1; });
      const all = new Set([...height.rows, ...muscle.rows, ...fat.rows].map(r => r.athleteCode));
      candidates.push({ rows, sampleSize: n, excludedCount: all.size - n, source: height.comparison.source, period: "fall_2026", heightUnit: height.comparison.unit, muscleUnit: muscle.comparison.unit });
    }
  }
  candidates.sort((a, b) => b.sampleSize - a.sampleSize || a.source.localeCompare(b.source) || a.heightUnit.localeCompare(b.heightUnit) || a.muscleUnit.localeCompare(b.muscleUnit));
  return candidates[0] ?? { rows: [], sampleSize: 0, excludedCount: 0, source: "", period: "fall_2026", heightUnit: "", muscleUnit: "" };
}
