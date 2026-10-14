import { COACHING_CATEGORIES, coachingVariables, progressRows, type CoachingCategory, type CoachingData } from "@/lib/coaching-tools";

/** Single-swing or single-throw maximums show the raw change; percentages exaggerate small best-ever moves. */
/** Body composition changes are shown on Team Progress but never ranked as jumps (descriptive, not performance). */
const BODY = new Set(["muscle_mass", "muscle_mass_pct", "body_fat_pct", "body_score", "weight", "height"]);
const RAW_CHANGE = /max_exit_velocity|max_bat_speed|max_distance|classified_max|max_pitch_velocity|infield_velocity|outfield_velocity/;
export type TeamMover = { athleteId: string; name: string; previous: number; latest: number; previousDate: string; latestDate: string; delta: number; percent: number | null; raw: boolean };
export type MoverBoard = { category: CoachingCategory; key: string; metric: string; label: string; source: string; unit: string; movers: TeamMover[]; compared: number };

/**
 * Biggest improvements since the previous test, per exact metric/source/unit, reusing Team Progress
 * rules: same comparable-test selection, the 1% Steady band, direction-aware improvement, and no
 * neutral body or spin metrics. Ranked by percent change (raw change for single-best maximums).
 */
export function teamMovers(data: CoachingData, today: string, perBoard = 3): MoverBoard[] {
  return COACHING_CATEGORIES.flatMap(category => coachingVariables(data, category, today).filter(v => !BODY.has(v.metric)).flatMap(variable => {
    const rows = progressRows(data, variable.key, today, 30).filter(r => r.delta !== null && r.latest && r.previous);
    const raw = RAW_CHANGE.test(variable.metric);
    const gains = rows.filter(r => !r.steady && r.tone === "positive").map(r => ({ athleteId: r.player.id, name: r.player.name, previous: r.previous!.value, latest: r.latest!.value,
      previousDate: r.previous!.date, latestDate: r.latest!.date, delta: r.delta!, percent: r.percent, raw }))
      .sort((a, b) => (raw ? Math.abs(b.delta) - Math.abs(a.delta) : Math.abs(b.percent ?? 0) - Math.abs(a.percent ?? 0)) || a.name.localeCompare(b.name));
    return gains.length ? [{ category, key: variable.key, metric: variable.metric, label: variable.label, source: variable.source, unit: variable.unit, movers: gains.slice(0, perBoard), compared: rows.length }] : [];
  }));
}
