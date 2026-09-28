import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { parseSavedAnalyticsViews } from "@/lib/saved-analytics";
export type DashboardVisitWindow = { since: string | null; viewedAt: string; record: boolean };
type Access = Awaited<ReturnType<typeof requireAccess>>;
export function dashboardVisitScope(access: Pick<Access, "roles" | "athleteId" | "preview">) {
  return canImportPresentedAccess(access) ? "staff" : access.athleteId ? `athlete:${access.athleteId}` : null;
}
export async function loadSavedAnalyticsViews(access: Access) {
  if (!canImportPresentedAccess(access)) throw new Error("Saved analytics are available to staff.");
  const { data, error } = await access.supabase.rpc("my_saved_analytics_views");
  if (error) throw new Error("Saved analytics views could not be loaded.");
  return parseSavedAnalyticsViews(data);
}
export async function loadDashboardVisit(access: Access, viewedAt: string): Promise<DashboardVisitWindow> {
  const scope = dashboardVisitScope(access);
  if (access.preview || !scope) return { since: null, viewedAt, record: false };
  const { data, error } = await access.supabase.rpc("my_dashboard_visit", { p_scope: scope });
  if (error) throw new Error("Your dashboard visit could not be loaded.");
  if (data === null) return { since: null, viewedAt, record: true };
  if (!data || Object.keys(data).sort().join(",") !== "previousSeenAt,seenAt" || typeof data.seenAt !== "string" || !Number.isFinite(Date.parse(data.seenAt)) || Date.parse(data.seenAt) > Date.parse(viewedAt) ||
    (data.previousSeenAt !== null && (typeof data.previousSeenAt !== "string" || !Number.isFinite(Date.parse(data.previousSeenAt)) || Date.parse(data.previousSeenAt) > Date.parse(data.seenAt)))) throw new Error("Your dashboard visit could not be verified.");
  return { since: Date.parse(viewedAt) - Date.parse(data.seenAt) > 30 * 60_000 ? data.seenAt : data.previousSeenAt, viewedAt, record: true };
}
