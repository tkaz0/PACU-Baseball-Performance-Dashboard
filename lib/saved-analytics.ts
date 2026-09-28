import { COLOR_GROUPS, type ColorGroup } from "@/lib/analytics";
import { UUID_PATTERN } from "@/lib/types";

export type AnalyticsViewConfig = { version: 1; x: string; y: string; period: "fall" | "earlier"; colorBy: ColorGroup; classFilter: string; positionFilter: string; window: number; hidden: string[] };
export type SavedAnalyticsView = { id: string; name: string; config: AnalyticsViewConfig; createdAt: string };
const clean = (v: unknown, max: number): v is string => typeof v === "string" && Array.from(v).length <= max && !/[\u0000-\u001f\u007f]/.test(v);
function axis(v: unknown): v is string {
  if (!clean(v, 600)) return false;
  try { const parts: unknown = JSON.parse(v); return Array.isArray(parts) && parts.length === 3 && parts.every(p => clean(p, 300) && p.length > 0); } catch { return false; }
}
export function parseAnalyticsViewConfig(value: unknown): AnalyticsViewConfig {
  const v = value as AnalyticsViewConfig;
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join(",") !== "classFilter,colorBy,hidden,period,positionFilter,version,window,x,y" ||
    v.version !== 1 || !axis(v.x) || !axis(v.y) || v.x === v.y || !["fall", "earlier"].includes(v.period) || !COLOR_GROUPS.some(g => g.key === v.colorBy) ||
    !clean(v.classFilter, 80) || !clean(v.positionFilter, 80) || ![0, 7, 30, 90, 366].includes(v.window) || !Array.isArray(v.hidden) || v.hidden.length > 50 ||
    v.hidden.some(h => !clean(h, 100)) || new Set(v.hidden).size !== v.hidden.length) throw new Error("Choose two different stats and valid filters before saving.");
  return { ...v, hidden: [...v.hidden] };
}
export function parseSavedAnalyticsViews(value: unknown): SavedAnalyticsView[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Saved views could not be verified.");
  const result = value.map((v: SavedAnalyticsView) => {
    if (!v || Object.keys(v).sort().join(",") !== "config,createdAt,id,name" || !UUID_PATTERN.test(v.id) || !clean(v.name, 60) || !v.name || v.name !== v.name.replace(/^ +| +$/g, "") || typeof v.createdAt !== "string" || !Number.isFinite(Date.parse(v.createdAt))) throw new Error("Saved views could not be verified.");
    return { id: v.id, name: v.name, createdAt: v.createdAt, config: parseAnalyticsViewConfig(v.config) };
  });
  if (new Set(result.map(v => v.id)).size !== result.length) throw new Error("Saved views could not be verified.");
  return result;
}
