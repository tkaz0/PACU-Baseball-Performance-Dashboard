export const PROFILE_TAB_IDS = ["overview", "physicality", "in-game", "practice", "progress"] as const;
export type ProfileTabId = typeof PROFILE_TAB_IDS[number];
/** Unknown or repeated URL values never select an additional data reader. */
export function profileTab(value: unknown): ProfileTabId {
  return typeof value === "string" && PROFILE_TAB_IDS.some(id => id === value) ? value as ProfileTabId : "overview";
}
export function profileTabHref(path: string, tab: string): string {
  return `${path}?tab=${encodeURIComponent(profileTab(tab))}`;
}
