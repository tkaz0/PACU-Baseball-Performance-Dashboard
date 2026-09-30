export const TREND_ANNOTATION_CATEGORIES = [
  { key: "grip", label: "Grip Change" },
  { key: "stance", label: "Stance Change" },
  { key: "swing_cue", label: "Swing Cue" },
  { key: "training", label: "Training Change" },
  { key: "other", label: "Coaching Note" },
] as const;
export const TREND_ANNOTATION_SCOPES = [
  { key: "all", label: "All Charts" },
  { key: "testing", label: "Physicality & Testing" },
  { key: "hitting_practice", label: "Hitting · Practice" },
  { key: "hitting_game", label: "Hitting · In-Game" },
  { key: "pitching_practice", label: "Pitching · Practice" },
  { key: "pitching_game", label: "Pitching · In-Game" },
] as const;
export type TrendAnnotationScope = typeof TREND_ANNOTATION_SCOPES[number]["key"];
export function isTrendAnnotationScope(value: unknown): value is TrendAnnotationScope {
  return TREND_ANNOTATION_SCOPES.some(scope => scope.key === value);
}
export function trendAnnotationScopeLabel(scope: TrendAnnotationScope): string {
  return TREND_ANNOTATION_SCOPES.find(item => item.key === scope)!.label;
}
/** Scope follows the chart's actual stored source and metric, never the player's roster role. */
export function profileTrendAnnotationScope(metricKey: string, source: string): TrendAnnotationScope {
  if (/^blast\b/i.test(source)) return "hitting_practice";
  const fullSwing = /^full swing\s*·\s*(game|intrasquad|practice|hitting|pitching)(?:\s*·.+)?$/i.exec(source.trim());
  if (fullSwing) {
    const category = fullSwing[1].toLowerCase();
    // Legacy Hitting/Pitching imports are practice, matching profile/session views.
    const practice = category !== "game" && category !== "intrasquad";
    const pitching = category === "pitching" || metricKey.startsWith("classified_") || ["max_pitch_velocity", "avg_pitch_velocity", "avg_fastball_spin", "strike_pct", "k_pct", "bb_pct"].includes(metricKey);
    return pitching ? (practice ? "pitching_practice" : "pitching_game") : (practice ? "hitting_practice" : "hitting_game");
  }
  return "testing";
}
export type TrendAnnotationCategory = typeof TREND_ANNOTATION_CATEGORIES[number]["key"];
export type TrendAnnotation = {
  id: string; athleteId: string; date: string; category: TrendAnnotationCategory; scope: TrendAnnotationScope;
  note: string; shared: boolean; archived: boolean; revision: number; createdAt: string;
};
export type TrendAnnotationActionState = { status: "idle" | "saved" | "invalid" | "stale" | "error" | "unverified"; message?: string };

export function isTrendAnnotationDate(value: unknown): value is string {
  return typeof value === "string" && /^2026-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    && value >= "2026-09-01" && value <= "2026-12-31";
}
export function isTrendAnnotationCategory(value: unknown): value is TrendAnnotationCategory {
  return TREND_ANNOTATION_CATEGORIES.some(category => category.key === value);
}
export function isTrendAnnotationNote(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length >= 1 && Array.from(value).length <= 400
    && value.replace(/^ +| +$/g, "") === value && !/[\u0000-\u001f\u007f]/.test(value);
}
export function trendAnnotationCategoryLabel(category: TrendAnnotationCategory): string {
  return TREND_ANNOTATION_CATEGORIES.find(item => item.key === category)!.label;
}
/** Calendar markers carry no measurement value: no new observation or interpolated result. */
export function trendAnnotationsInRange(items: readonly TrendAnnotation[], dates: readonly string[], scope?: TrendAnnotationScope): TrendAnnotation[] {
  if (dates.length < 2 || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return [];
  const sortedDates = [...dates].sort();
  if (sortedDates[0] === sortedDates.at(-1)) return [];
  return items.filter(item => !item.archived && (!scope || item.scope === "all" || item.scope === scope) && isTrendAnnotationDate(item.date) && item.date >= sortedDates[0] && item.date <= sortedDates.at(-1)!)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
