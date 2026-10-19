import { analyticsVariables, linearFit, pairAnalytics, readingsForPeriod, type AnalyticsDataset, type AnalyticsReading, type AnalyticsVariable } from "@/lib/analytics";

/**
 * Owner-requested October 19: a fixed list of stat pairs Analytics tracks week to week. Each pair uses
 * the same Fall readings and pairing as the scatterplot (any test date in the period), plus sample
 * minimums for cumulative game stats so tiny samples do not swing the score. Descriptive only.
 */
type Match = { metric: string; unit?: string; source: (source: string) => boolean };
export type ConnectionPair = { key: string; title: string; why: string; x: Match; y: Match; status: "strong" | "watch" };
const s = (source: string) => source.trim().toLowerCase();
const inGameFullSwing = (source: string) => /^full swing · (game|intrasquad)$/.test(s(source));
const inGameFourSeam = (source: string) => /^full swing · (game|intrasquad) · four-seam fastball$/.test(s(source));
const pitchingSheet = (source: string) => s(source).startsWith("pitching · fall 2026 cumulative");
const qpaSheet = (source: string) => s(source).startsWith("qpa · fall cumulative");
const blastFall = (source: string) => s(source).startsWith("blast motion") && !s(source).includes("p95");
const renpho = (source: string) => s(source).includes("renpho");

export const CONNECTION_PAIRS: readonly ConnectionPair[] = [
  { key: "strike_whip", status: "strong", title: "Strike % → WHIP", why: "Pitchers who throw more strikes allow fewer base runners.", x: { metric: "strike_pct", source: pitchingSheet }, y: { metric: "pitching_whip", source: pitchingSheet } },
  { key: "strike_bb9", status: "strong", title: "Strike % → BB/9", why: "The direct link behind the team's walk numbers.", x: { metric: "strike_pct", source: pitchingSheet }, y: { metric: "pitching_bb9", source: pitchingSheet } },
  { key: "fb_velo_k9", status: "strong", title: "Fastball velocity → K/9", why: "Harder four-seam fastballs, more strikeouts.", x: { metric: "classified_avg_velocity", unit: "mph", source: inGameFourSeam }, y: { metric: "pitching_k9", source: pitchingSheet } },
  { key: "muscle_bat_speed", status: "strong", title: "Muscle mass → bat speed", why: "Strength work showing up in swing speed.", x: { metric: "muscle_mass", unit: "lb", source: renpho }, y: { metric: "avg_bat_speed", unit: "mph", source: blastFall } },
  { key: "blast_game_bat_speed", status: "strong", title: "Practice → in-game bat speed", why: "Blast practice swings carry over to Full Swing in games.", x: { metric: "avg_bat_speed", unit: "mph", source: blastFall }, y: { metric: "avg_bat_speed", unit: "mph", source: inGameFullSwing } },
  { key: "max_ev_hh", status: "watch", title: "Max EV → HH %", why: "Full Swing and the QPA sheet agreeing on hard contact.", x: { metric: "max_exit_velocity", unit: "mph", source: inGameFullSwing }, y: { metric: "batting_hh_pct", source: qpaSheet } },
  { key: "fb_spin_strike", status: "watch", title: "Fastball spin → Strike %", why: "Early sign that high-spin arms throw fewer strikes.", x: { metric: "classified_avg_spin", unit: "rpm", source: inGameFourSeam }, y: { metric: "strike_pct", source: pitchingSheet } },
  { key: "bat_speed_ops", status: "watch", title: "Bat speed → OPS", why: "Not connected yet; watch whether practice speed starts showing up in game results.", x: { metric: "avg_bat_speed", unit: "mph", source: blastFall }, y: { metric: "batting_ops", source: qpaSheet } },
];

/** Hitters need 15+ PA and pitchers 9+ outs (3 IP) on the cumulative game sheets. */
export const GAME_MINIMUMS = { pa: 15, outs: 9 } as const;
function meetsMinimum(row: AnalyticsReading): boolean {
  if (row.opportunities === undefined) return !(qpaSheet(row.source) || pitchingSheet(row.source));
  return qpaSheet(row.source) ? row.opportunities >= GAME_MINIMUMS.pa : pitchingSheet(row.source) ? row.opportunities >= GAME_MINIMUMS.outs : true;
}
function pick(variables: readonly AnalyticsVariable[], match: Match): AnalyticsVariable | null {
  const options = variables.filter(v => v.metric === match.metric && (!match.unit || v.unit === match.unit) && match.source(v.source));
  return options.sort((a, b) => b.count - a.count)[0] ?? null;
}
/** Approximate two-tailed 5% cutoff for Pearson r with n players. */
export const chanceCutoff = (n: number) => n > 3 ? 1.96 / Math.sqrt(n - 1) : 1;
export function connectionStrength(r: number | null): string {
  if (r === null) return "Not enough data";
  const a = Math.abs(r);
  return a >= 0.6 ? "Strong" : a >= 0.4 ? "Moderate" : a >= 0.2 ? "Weak" : "Little";
}

export type ConnectionResult = { pair: ConnectionPair; r: number | null; n: number; xKey: string | null; yKey: string | null; xLabel: string; yLabel: string };
export function keyConnections(data: AnalyticsDataset): ConnectionResult[] {
  const readings = readingsForPeriod(data.readings, "fall"), variables = analyticsVariables(readings);
  return CONNECTION_PAIRS.map(pair => {
    const x = pick(variables, pair.x), y = pick(variables, pair.y);
    if (!x || !y) return { pair, r: null, n: 0, xKey: x?.key ?? null, yKey: y?.key ?? null, xLabel: x?.label ?? "", yLabel: y?.label ?? "" };
    const points = pairAnalytics(data.players, readings, x.key, y.key, 366).points.filter(p => meetsMinimum(p.x) && meetsMinimum(p.y));
    const fit = linearFit(points.map(p => ({ x: p.x.value, y: p.y.value })));
    return { pair, r: fit?.r ?? null, n: points.length, xKey: x.key, yKey: y.key, xLabel: x.label, yLabel: y.label };
  });
}

/** The Monday that starts the current Pacific week. */
export function pacificWeekStart(today: string): string {
  const date = new Date(`${today}T12:00:00Z`), back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}
export type ConnectionSnapshot = { weekStart: string; pair: string; r: number | null; n: number };
/** Weekly history per pair (oldest first) with this week's live value in place of any saved one. */
export function connectionHistory(snapshots: readonly ConnectionSnapshot[], current: readonly ConnectionResult[], weekStart: string) {
  return Object.fromEntries(current.map(result => {
    const saved = snapshots.filter(s => s.pair === result.pair.key && s.weekStart < weekStart).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return [result.pair.key, [...saved, { weekStart, pair: result.pair.key, r: result.r, n: result.n }]];
  })) as Record<string, ConnectionSnapshot[]>;
}
