import type { RosterAthlete } from "@/lib/types";
import type { StoredMeasurement } from "@/lib/local-workspace";

// A browser-local display preference, never a trusted account role.
export type LocalView = { role: "admin" | "coach" | "player"; athleteCode: string | null };
export const LOCAL_VIEW_KEY = "pacu-workspace-view-v1";
export const adminView = (): LocalView => ({ role: "admin", athleteCode: null });

export function parseLocalView(raw: string | null): LocalView {
  if (!raw) return adminView();
  try {
    const value = JSON.parse(raw);
    if (value?.role === "coach") return { role: "coach", athleteCode: null };
    if (value?.role === "player") return { role: "player", athleteCode: typeof value.athleteCode === "string" && /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(value.athleteCode) ? value.athleteCode : null };
  } catch { /* An invalid display preference does not change saved data. */ }
  return adminView();
}

export function projectLocalView(view: LocalView, roster: RosterAthlete[], measurements: StoredMeasurement[]) {
  if (view.role !== "player") return { roster, measurements };
  const visible = roster.filter(a => a.athlete_code === view.athleteCode);
  if (visible.length !== 1) return { roster: [], measurements: [] };
  return { roster: visible, measurements: measurements.filter(m => m.athlete_code === visible[0].athlete_code) };
}

export function localViewAllowsPath(view: LocalView, pathname: string): boolean {
  if (view.role === "admin") return true;
  pathname = pathname.replace(/\/+$/, "");
  if (["/preview/import", "/preview/access"].some(path => pathname === path || pathname.startsWith(`${path}/`))) return false;
  if (view.role === "coach") return true;
  if (pathname === "/preview") return true;
  return !!view.athleteCode && pathname === `/preview/athletes/${view.athleteCode}`;
}
