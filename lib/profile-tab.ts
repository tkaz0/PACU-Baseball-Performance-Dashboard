export const PROFILE_TAB_IDS = ["overview", "game-stats", "hitting", "pitching", "practice", "physicality", "progress"] as const;
export type ProfileTabId = typeof PROFILE_TAB_IDS[number];
/** Unknown or repeated URL values never select an additional data reader. The retired In-Game tab opens Game Stats. */
export function profileTab(value: unknown): ProfileTabId {
  if (value === "in-game") return "game-stats";
  return typeof value === "string" && PROFILE_TAB_IDS.some(id => id === value) ? value as ProfileTabId : "overview";
}
/** Hitting and Pitching follow the existing role rules; an unavailable tab falls back to Game Stats. */
export function profileTabForRole(tab: ProfileTabId, role: { hitting: boolean; pitching: boolean }): ProfileTabId {
  return (tab === "hitting" && !role.hitting) || (tab === "pitching" && !role.pitching) ? "game-stats" : tab;
}
export type ProfileDetail = "quick" | "full";
export function profileDetail(value: unknown): ProfileDetail { return value === "full" ? "full" : "quick"; }
export function profileTabHref(path: string, tab: string, detail?: ProfileDetail): string {
  return `${path}?tab=${encodeURIComponent(profileTab(tab))}${detail === "full" ? "&detail=full" : ""}`;
}
