import { analyticsVariables, linearFit, pairAnalytics, type AnalyticsPlayer, type AnalyticsReading, type AnalyticsVariable } from "@/lib/analytics";

export type CorrelationCell = { x: AnalyticsVariable; y: AnalyticsVariable; count: number; r: number | null; rSquared: number | null; same: boolean };
export const MAX_MAP_VARIABLES = 8;
/** A useful opening mix. A source or unit is never blended with another. */
export function defaultMapVariables(variables: readonly AnalyticsVariable[]): string[] {
  const selected: string[] = [];
  for (const metric of ["max_exit_velocity", "avg_bat_speed", "home_to_first", "muscle_mass", "body_fat_pct", "grip_dominant"]) {
    const candidates = variables.filter(v => v.metric === metric).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    if (candidates[0]) selected.push(candidates[0].key);
  }
  for (const variable of [...variables].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))) {
    if (selected.length >= 6) break;
    if (!selected.includes(variable.key)) selected.push(variable.key);
  }
  return selected;
}

/** Every cell uses the same pairing, date-window and minimum-N rules as Analytics. */
export function correlationMap(players: readonly AnalyticsPlayer[], readings: readonly AnalyticsReading[], keys: readonly string[], maxGap: number): CorrelationCell[][] {
  const catalog = analyticsVariables(readings);
  const variables = [...new Set(keys)].slice(0, MAX_MAP_VARIABLES).map(key => catalog.find(v => v.key === key)).filter((v): v is AnalyticsVariable => !!v);
  const window = [0, 7, 30, 90, 366].includes(maxGap) ? maxGap : 30;
  return variables.map(y => variables.map(x => {
    const points = pairAnalytics(players, readings, x.key, y.key, window).points;
    const same = x.key === y.key;
    const fit = same ? null : linearFit(points.map(p => ({ x: p.x.value, y: p.y.value })));
    return { x, y, same, count: points.length, r: fit?.r ?? null, rSquared: fit?.rSquared ?? null };
  }));
}

export function correlationColor(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return "var(--surface-raised)";
  const strength = Math.min(1, Math.abs(r));
  return `color-mix(in srgb, ${r < 0 ? "#347dcc" : "#c74655"} ${Math.round(12 + strength * 76)}%, var(--surface-panel))`;
}

export function correlationScatterUrl(cell: CorrelationCell, period: "fall" | "earlier", maxGap: number): string {
  const params = new URLSearchParams({ x: cell.x.key, y: cell.y.key, period, window: String(maxGap) });
  return `/analytics?${params.toString()}`;
}
