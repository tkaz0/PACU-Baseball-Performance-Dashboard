export const PROFILE_TAB_IDS = ["overview", "physicality", "in-game", "practice", "progress"] as const;
export type ProfileTabId = typeof PROFILE_TAB_IDS[number];
/** Unknown or repeated URL values never select an additional data reader. */
export function profileTab(value: unknown): ProfileTabId {
  return typeof value === "string" && PROFILE_TAB_IDS.some(id => id === value) ? value as ProfileTabId : "overview";
}
export type ProfileDetail = "quick" | "full";
export function profileDetail(value: unknown): ProfileDetail { return value === "full" ? "full" : "quick"; }
export function profileTabHref(path: string, tab: string, detail?: ProfileDetail): string {
  return `${path}?tab=${encodeURIComponent(profileTab(tab))}${detail === "full" ? "&detail=full" : ""}`;
}
