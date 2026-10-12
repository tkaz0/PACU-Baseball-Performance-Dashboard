import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadGameStats } from "@/lib/game-server";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { loadMovementScreening } from "@/lib/movement-server";
import { loadFullSwingContacts } from "@/lib/full-swing-contacts-server";
import { loadPlayerFallSummaries } from "@/lib/player-fall-summaries-server";
import { loadContactsAllowed } from "@/lib/contacts-allowed-server";
import { loadAthleteGameWeeks } from "@/lib/game-weeks-server";
import { loadOwnPitchGrades } from "@/lib/pitch-grades-server";
import { profileShowsPitching } from "@/lib/player-profile-layout";
import { buildExitMeetingReport, exitMeetingFormat, type ExitMeetingFormat } from "@/lib/exit-meeting";

type Access = Awaited<ReturnType<typeof requireAccess>>;
export class ExitMeetingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
/** Every entry point passes freshly verified access. No role, report, or statistics arrive from the browser. */
export async function loadExitMeetingReport(access: Access, athleteId: string, format: ExitMeetingFormat = "meeting") {
  const selectedFormat = exitMeetingFormat(format);
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
    selectedFormat === "detailed" ? loadMovementScreening(access, athleteId, athlete.athlete_code) : Promise.resolve(null),
    selectedFormat === "detailed" ? loadFullSwingContacts(access, athleteId) : Promise.resolve([]),
  ]);
  const season = athlete.athlete_seasons.find(s => s.season === "2026-27"), pitcher = profileShowsPitching(season);
  // Optional sections: a failed reader omits its section rather than the whole report.
  const [fallSummaries, contactsAllowed, weeks] = await Promise.all([
    loadPlayerFallSummaries(access, athlete.athlete_code, performance.measurements).catch(() => []),
    pitcher ? loadContactsAllowed(access, athleteId).catch(() => null) : Promise.resolve(null),
    loadAthleteGameWeeks(access, athleteId).catch(() => null),
  ]);
  const pitchGrades = pitcher ? await loadOwnPitchGrades(access, { id: athlete.id, code: athlete.athlete_code, name: `${athlete.preferred_name ?? athlete.first_name} ${athlete.last_name}`, academicClass: "", position: "", playerType: "", bats: "", throws: "" }, performance.measurements, contactsAllowed).catch(() => null) : null;
  const report = buildExitMeetingReport({ athlete, ...performance, games, comparisons, movement, contacts, fallSummaries, contactsAllowed, weeks, pitchGrades, generatedAt: new Date().toISOString() }, selectedFormat);
  const unavailable = [...(pitcher && contactsAllowed === null ? ["Contact Allowed"] : []), ...(pitcher && pitchGrades === null ? ["Pitch+"] : []), ...(weeks === null ? ["Week by Week"] : [])];
  if (unavailable.length) report.notes.push(`Temporarily unavailable in this report: ${unavailable.join(", ")}. Other sections are complete.`);
  return report;
}
