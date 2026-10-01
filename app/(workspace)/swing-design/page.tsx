import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ScanLine } from "lucide-react";
import { requireRenderAccess } from "@/lib/render-access";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { loadDesignAthleteChoices } from "@/lib/staff-athlete-search-server";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadHittingTeamAverages } from "@/lib/hitting-team-server";
import { loadBlastBatSpeedPercentile } from "@/lib/blast-speed-percentile-server";
import { getPlayerPerformance } from "@/lib/player-performance";
import { seasonDesignNavigation } from "@/lib/design-navigation";
import { hitterSwingProfile } from "@/lib/hitter-swing-profile";
import { athleteName, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";
import { HitterSwingBlueprint } from "@/components/hitter-swing-blueprint";
import { SwingDesignPlayerPicker } from "@/components/swing-design-player-picker";

export const metadata = { title: "Swing Design" };
type SwingAthlete = Pick<RosterAthlete, "id" | "athlete_code" | "first_name" | "last_name" | "preferred_name" | "athlete_seasons">;

function EmptySwingDesign({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center" aria-label="Swing Design status">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--surface-page)] text-pacu-red"><ScanLine size={28} aria-hidden="true"/></span>
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{children}</p>
  </section>;
}

export default async function SwingDesignPage({ searchParams }: { searchParams?: Promise<{ athlete?: string | string[] }> }) {
  const access = await requireRenderAccess();
  const query = await searchParams;
  const staff = access.roles.some(role => role === "admin" || role === "coach");
  const requestedId = query?.athlete;
  // Reject a tampered player selection before any roster or measurement request.
  if (requestedId !== undefined && (typeof requestedId !== "string" || !UUID_PATTERN.test(requestedId) || !canReadPresentedAthlete(access, requestedId))) notFound();
  const athleteId = requestedId ?? (staff ? null : access.athleteId);
  if (athleteId && (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId))) notFound();
  const players = staff ? await loadDesignAthleteChoices(access, "swing") : [];
  let athlete: SwingAthlete | null = null;
  if (athleteId) {
    const { data, error } = await access.supabase.from("athletes")
      .select("id,athlete_code,first_name,last_name,preferred_name,athlete_seasons(*)")
      .eq("id", athleteId).maybeSingle();
    if (error) throw new Error("Unable to load this player's Swing Design.");
    if (!data || typeof data.id !== "string" || data.id.toLowerCase() !== athleteId.toLowerCase()) notFound();
    athlete = data as SwingAthlete;
  }
  const season = athlete?.athlete_seasons.find(item => item.season === "2026-27");
  const showHitting = !!athlete && seasonDesignNavigation(season).swing;
  const content = athlete && showHitting ? await (async () => {
    const [shared, teamAverages, speedReference] = await Promise.all([
      loadAthletePerformance(access, athlete, { includePercentiles: true }),
      loadHittingTeamAverages(access),
      loadBlastBatSpeedPercentile(access, athlete.id),
    ]);
    const performance = getPlayerPerformance({ readings: shared.measurements, batches: shared.batches, athleteCode: athlete.athlete_code, cohortAthleteCodes: [], percentileOverrides: shared.percentileOverrides });
    if (!hitterSwingProfile(shared.measurements, performance).summary) return <EmptySwingDesign title="Practice Results Coming Soon">The swing diagrams and MLB study cards will appear after a Blast average report is saved for this player.</EmptySwingDesign>;
    return <HitterSwingBlueprint readings={shared.measurements} performance={performance} teamAverages={teamAverages} bats={season?.bats} batSpeedReference={speedReference?.athleteId === athlete.id ? speedReference : null}/>;
  })() : null;
  return <>
    <PageHeading section="Pacific Baseball / Player Development" title="Swing Design" description="Bat path, barrel angle, posture, and same-side MLB swings to study."/>
    {staff && <SwingDesignPlayerPicker key={athlete?.id ?? "none"} players={players} selectedId={athlete?.id ?? ""}/>}
    {athlete && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] px-5 py-4">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{athleteName(athlete)}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{athlete.athlete_code}{season?.bats ? ` · Bats ${season.bats}` : ""} · Fall 2026</p></div>
      <Link prefetch={false} className="text-link text-sm" href={`/athletes/${athlete.id}`}>Player Profile <ArrowUpRight size={15} aria-hidden="true"/></Link>
    </div>}
    {content ?? (athlete ? <EmptySwingDesign title={season ? "Built for Hitting Practice" : "No Fall Roster Entry"}>{season ? "Swing Design is available for position players and two-way players. Pitching results remain on the player profile." : "This player needs a 2026–27 roster entry before Fall swing results can appear."}</EmptySwingDesign> : staff ? <EmptySwingDesign title="Choose a Hitter">Open a player’s angles and posture, then find same-side MLB swings to study.</EmptySwingDesign> : <EmptySwingDesign title="Your Player Profile Is Not Linked">Ask a coach or administrator to link your account to your existing player profile.</EmptySwingDesign>)}
  </>;
}
