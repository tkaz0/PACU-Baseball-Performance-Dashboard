import type { SavedContact } from "@/lib/full-swing-contacts-server";

export type SquaredUpSummary = { count: number; total: number; avgSquaredUp: number | null; avgPotential: number | null; maxPotential: number | null; avgGap: number | null };
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Only contacts with a saved Squared Up and Potential EV from the same CSV row; others are counted, never estimated. */
export function squaredUpSummary(contacts: readonly SavedContact[]): SquaredUpSummary {
  const rows = contacts.filter(row => typeof row.squaredUp === "number" && typeof row.potentialExitVelocity === "number");
  return {
    count: rows.length, total: contacts.length,
    avgSquaredUp: mean(rows.map(row => row.squaredUp! * 100)),
    avgPotential: mean(rows.map(row => row.potentialExitVelocity!)),
    maxPotential: rows.length ? Math.max(...rows.map(row => row.potentialExitVelocity!)) : null,
    avgGap: mean(rows.map(row => row.potentialExitVelocity! - row.exitVelocity)),
  };
}

export type SessionTrend = { key: string; label: string; unit: string; points: { date: string; value: number; count: number }[] };
/** One point per session date (all saved files that day combined); a series needs two or more dates. */
export function contactSessionTrends(contacts: readonly SavedContact[]): SessionTrend[] {
  const dates = [...new Set(contacts.map(row => row.playedOn))].sort();
  const series = (key: string, label: string, unit: string, value: (rows: SavedContact[]) => { value: number | null; count: number }) => ({ key, label, unit,
    points: dates.flatMap(date => { const result = value(contacts.filter(row => row.playedOn === date)); return result.value === null ? [] : [{ date, value: result.value, count: result.count }]; }) });
  return [
    series("avg_ev", "Average Exit Velocity", "mph", rows => ({ value: mean(rows.map(row => row.exitVelocity)), count: rows.length })),
    series("hard_hit", "Hard Hit %", "%", rows => ({ value: rows.length ? 100 * rows.filter(row => row.exitVelocity >= 90).length / rows.length : null, count: rows.length })),
    series("squared_up", "Squared Up %", "%", rows => { const with_ = rows.filter(row => typeof row.squaredUp === "number"); return { value: mean(with_.map(row => row.squaredUp! * 100)), count: with_.length }; }),
    series("launch", "Average Launch Angle", "°", rows => ({ value: mean(rows.map(row => row.launchAngle)), count: rows.length })),
  ].filter(item => item.points.length >= 2);
}
