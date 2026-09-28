"use server";
import { requireImportAccess } from "@/lib/auth";
import { analyticsVariables, readingsForPeriod } from "@/lib/analytics";
import { loadAnalytics } from "@/lib/analytics-server";
import { loadSavedAnalyticsViews } from "@/lib/personal-dashboard-server";
import { parseAnalyticsViewConfig, type SavedAnalyticsView } from "@/lib/saved-analytics";
import { UUID_PATTERN } from "@/lib/types";
export type SavedViewActionResult = { views?: SavedAnalyticsView[]; error?: string };
export async function saveAnalyticsView(input: { id: string; name: string; config: unknown }): Promise<SavedViewActionResult> {
  const access = await requireImportAccess();
  try {
    if (!input || !UUID_PATTERN.test(input.id) || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(input.name)) return { error: "Give this view a short name." };
    const config = parseAnalyticsViewConfig(input.config), data = await loadAnalytics();
    const variables = analyticsVariables(readingsForPeriod(data.readings, config.period));
    if (![config.x, config.y].every(key => variables.some(v => v.key === key))) return { error: "One of these stats is no longer available. Refresh and choose the stats again." };
    const { data: saved, error } = await access.supabase.rpc("save_my_analytics_view", { p_id: input.id, p_name: input.name.trim(), p_config: config });
    if (error || saved !== input.id) return { error: "This view could not be confirmed. Retry the same save or refresh your saved views; you can keep up to 20." };
    return { views: await loadSavedAnalyticsViews(access) };
  } catch { return { error: "The view could not be saved. Refresh and check the selected stats." }; }
}
export async function archiveAnalyticsView(id: string): Promise<SavedViewActionResult> {
  const access = await requireImportAccess();
  if (!UUID_PATTERN.test(id)) return { error: "Choose a saved view." };
  const { data, error } = await access.supabase.rpc("archive_my_analytics_view", { p_id: id });
  if (error || data !== true) return { error: "The view could not be archived. Refresh and try again." };
  return { views: await loadSavedAnalyticsViews(access) };
}
