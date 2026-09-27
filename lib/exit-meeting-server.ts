import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadGameStats } from "@/lib/game-server";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { loadMovementScreening } from "@/lib/movement-server";
import { loadFullSwingContacts } from "@/lib/full-swing-contacts-server";
import { buildExitMeetingReport } from "@/lib/exit-meeting";

type Access = Awaited<ReturnType<typeof requireAccess>>;
export class ExitMeetingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
/** Every entry point passes freshly verified access. No role, report, or statistics arrive from the browser. */
export async function loadExitMeetingReport(access: Access, athleteId: string) {
  if (!canImportPresentedAccess(access)) throw new ExitMeetingError("Exit meetings are available to coaches and admins.", 403);
  if (!UUID_PATTERN.test(athleteId)) throw new ExitMeetingError("Choose a rostered player.", 400);
  const { data, error } = await access.supabase.from("athletes")
    .select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)")
    .eq("id", athleteId).maybeSingle();
  if (error) throw new ExitMeetingError("This player could not be loaded. Try again.", 503);
  if (!data || data.id !== athleteId || !data.athlete_seasons?.some((s: { season: string }) => s.season === "2026-27")) throw new ExitMeetingError("This player is not on the current roster.", 404);
  const athlete = data as RosterAthlete;
  const [performance, games, comparisons, movement, contacts] = await Promise.all([
    loadAthletePerformance(access, athlete), loadGameStats(access, athleteId), loadGameComparisons(access, athleteId),
    loadMovementScreening(access, athleteId, athlete.athlete_code), loadFullSwingContacts(access, athleteId),
  ]);
  return buildExitMeetingReport({ athlete, ...performance, games, comparisons, movement, contacts, generatedAt: new Date().toISOString() });
}
