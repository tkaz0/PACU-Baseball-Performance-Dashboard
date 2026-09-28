"use server";
import { requireAccess } from "@/lib/auth";
import { dashboardVisitScope } from "@/lib/personal-dashboard-server";
export async function recordDashboardVisit(viewedAt: string): Promise<boolean> {
  const access = await requireAccess();
  const scope = dashboardVisitScope(access);
  if (access.preview || !scope) return false;
  if (typeof viewedAt !== "string" || !Number.isFinite(Date.parse(viewedAt)) || Date.parse(viewedAt) > Date.now() || Date.now() - Date.parse(viewedAt) > 15 * 60_000) return false;
  const { data, error } = await access.supabase.rpc("record_my_dashboard_visit", { p_scope: scope, p_viewed_at: viewedAt });
  return !error && data === true;
}
