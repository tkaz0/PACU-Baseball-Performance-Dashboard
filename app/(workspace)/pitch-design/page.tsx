import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ScanLine } from "lucide-react";
import { requireRenderAccess } from "@/lib/render-access";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { loadAthletePerformance } from "@/lib/performance-server";
import { getPlayerPerformance } from "@/lib/player-performance";
import { seasonDesignNavigation } from "@/lib/design-navigation";
import { athleteName, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";
import { PitchDesignDashboard } from "@/components/pitch-design-dashboard";
import { PitchDesignPlayerPicker } from "@/components/pitch-design-player-picker";

export const metadata = { title: "Pitch Design" };
type PitchAthlete = Pick<RosterAthlete, "id" | "athlete_code" | "first_name" | "last_name" | "preferred_name" | "athlete_seasons">;

function EmptyPitchDesign({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center" aria-label="Pitch Design status">
    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--surface-page)] text-pacu-red"><ScanLine size={28} aria-hidden="true"/></span>
    <h2 className="text-xl font-semibold">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">{children}</p>
  </section>;
}

export default async function PitchDesignPage({ searchParams }: { searchParams?: Promise<{ athlete?: string | string[] }> }) {
  const access = await requireRenderAccess();
  const query = await searchParams;
  const staff = access.roles.some(role => role === "admin" || role === "coach");
  const requestedId = query?.athlete;
  // Reject a tampered player selection before any roster or measurement request.
  if (requestedId !== undefined && (typeof requestedId !== "string" || !UUID_PATTERN.test(requestedId) || !canReadPresentedAthlete(access, requestedId))) notFound();
  const athleteId = requestedId ?? (staff ? null : access.athleteId);
  if (athleteId && (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId))) notFound();
  const players = staff ? await loadStaffAthleteChoices(access) : [];
  let athlete: PitchAthlete | null = null;
  if (athleteId) {
    const { data, error } = await access.supabase.from("athletes")
      .select("id,athlete_code,first_name,last_name,preferred_name,athlete_seasons(*)")
      .eq("id", athleteId).maybeSingle();
    if (error) throw new Error("Unable to load this player's Pitch Design.");
    if (!data || typeof data.id !== "string" || data.id.toLowerCase() !== athleteId.toLowerCase()) notFound();
    athlete = data as PitchAthlete;
  }
  const season = athlete?.athlete_seasons.find(item => item.season === "2026-27");
  const showPitching = !!athlete && seasonDesignNavigation(season).pitch;
  const content = athlete && showPitching ? await (async () => {
    const shared = await loadAthletePerformance(access, athlete, { includePercentiles: true });
    const performance = getPlayerPerformance({ readings: shared.measurements, batches: shared.batches, athleteCode: athlete.athlete_code, cohortAthleteCodes: [], percentileOverrides: shared.percentileOverrides });
    return <PitchDesignDashboard readings={shared.measurements} performance={performance} throws={season?.throws}/>;
  })() : null;
  return <>
    <PageHeading section="Pacific Baseball / Player Development" title="Pitch Design" description="Your arsenal, grip options, and MLB pitchers to study."/>
    {staff && <PitchDesignPlayerPicker key={athlete?.id ?? "none"} players={players} selectedId={athlete?.id ?? ""}/>}
    {athlete && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-panel)] px-5 py-4">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{athleteName(athlete)}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{athlete.athlete_code}{season?.throws ? ` · Throws ${season.throws}` : ""} · Fall 2026</p></div>
      <Link prefetch={false} className="text-link text-sm" href={`/athletes/${athlete.id}`}>Player Profile <ArrowUpRight size={15} aria-hidden="true"/></Link>
    </div>}
    {content ?? (athlete ? <EmptyPitchDesign title={season ? "Built for Pitchers" : "No Fall Roster Entry"}>{season ? "Pitch Design is available for pitchers and two-way players. Hitting results remain in Swing Design." : "This player needs a 2026–27 roster entry before Fall pitch results can appear."}</EmptyPitchDesign> : staff ? <EmptyPitchDesign title="Choose a Pitcher">Explore a pitcher’s arsenal, compare speed and spin, and find grips and MLB pitchers to study.</EmptyPitchDesign> : <EmptyPitchDesign title="Your Player Profile Is Not Linked">Ask a coach or administrator to link your account to your existing player profile.</EmptyPitchDesign>)}
  </>;
}
