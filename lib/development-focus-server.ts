import "server-only";
import { requireRenderAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { loadGameStats } from "@/lib/game-server";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import type { PowerContact } from "@/lib/development-focus";

/** Staff only. Game stats and contacts use the existing staff readers; Squared Up uses the staff-only RPC. */
export async function loadDevelopmentFocusData() {
  const access = await requireRenderAccess(["admin", "coach"]);
  if (!canImportPresentedAccess(access)) throw new Error("Development Focus is available to staff.");
  const [roster, stats, contactRows, quality, weekly] = await Promise.all([
    loadTopPerformersData(), loadGameStats(access),
    access.supabase.from("full_swing_contacts").select("file_hash,source_row,athlete_id,category,exit_velocity,launch_angle,direction").in("category", ["game", "intrasquad"]).limit(5000),
    access.supabase.rpc("team_contact_quality"),
    loadGameWeeks(access).catch(() => null),
  ]);
  // Weeks so far set the optional minimum (1 IP per Fall Ball week); a failed weekly read keeps one week.
  const weeks = Math.max(1, ...(weekly ? weekly.weeks.pitching.map(week => week.week) : []));
  if (contactRows.error || !Array.isArray(contactRows.data)) throw new Error("Batted-ball results could not be loaded.");
  const squared = new Map<string, number>();
  if (!quality.error && Array.isArray(quality.data)) for (const row of quality.data) if (typeof row?.file_hash === "string" && Number.isSafeInteger(row.source_row) && typeof row.squared_up === "number" && row.squared_up > 0 && row.squared_up <= 1) squared.set(`${row.file_hash}:${row.source_row}`, row.squared_up);
  const contacts: PowerContact[] = contactRows.data.flatMap(row => typeof row.athlete_id === "string" && typeof row.exit_velocity === "number" && Number.isFinite(row.exit_velocity) && row.exit_velocity > 0 && typeof row.launch_angle === "number" && Math.abs(row.launch_angle) <= 90
    ? [{ athleteId: row.athlete_id, category: row.category, exitVelocity: row.exit_velocity, launchAngle: row.launch_angle, direction: typeof row.direction === "number" ? row.direction : null, squaredUp: squared.get(`${row.file_hash}:${row.source_row}`) ?? null }] : []);
  return { players: roster.players, stats, contacts, squaredAvailable: !quality.error, weeks };
}
