import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { fallBallWeekDates } from "@/lib/game-weeks";
import { missingFullSwingWeeks } from "@/lib/full-swing-week-gaps";
import { pacificTestingDate } from "@/lib/testing-checklist";

/** Staff only: dates of saved in-game Full Swing contact, compared with the confirmed Fall Ball week dates. */
export async function loadMissingFullSwingWeeks(access: Awaited<ReturnType<typeof requireAccess>>) {
  if (!canImportPresentedAccess(access)) return [];
  const { data, error } = await access.supabase.from("full_swing_contacts").select("played_on").in("category", ["game", "intrasquad"]).gte("played_on", "2026-09-01").lte("played_on", "2026-12-31").limit(5000);
  if (error || !Array.isArray(data)) throw new Error("Full Swing session dates could not be loaded.");
  const dates = [...new Set(data.flatMap(row => typeof row.played_on === "string" && /^2026-\d{2}-\d{2}$/.test(row.played_on) ? [row.played_on] : []))];
  return missingFullSwingWeeks(fallBallWeekDates(), dates, pacificTestingDate());
}
