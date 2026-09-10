import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { display, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { loadAthletePerformance } from "@/lib/performance-server";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { getPlayerPerformance, normalizePlayerMetric, PLAYER_METRICS } from "@/lib/player-performance";
import { getRenphoReports } from "@/lib/renpho-charts";
import { RenphoCharts } from "@/components/renpho-charts";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { profileMeasurementVisible } from "@/lib/player-profile-layout";

export default async function Profile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ preview?: string }> }) {
  const access = await requireAccess();
  const { supabase, roles } = access;
  const { id } = await params;
  if (!UUID_PATTERN.test(id) || !canReadPresentedAthlete(access, id)) notFound();
  const query = await searchParams;
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this athlete profile.");
  if (!data) notFound();
  const athlete = data as RosterAthlete;
  const seasons = [...athlete.athlete_seasons].sort((a,b) => b.season.localeCompare(a.season));
  const season = seasons.find(item => item.season === "2026-27") ?? seasons[0];
  const staff = roles.includes("admin") || roles.includes("coach");
  const admin = roles.includes("admin");
  const shared = await loadAthletePerformance(access,athlete);
  const performance = getPlayerPerformance({ readings:shared.measurements, batches:shared.batches, athleteCode:athlete.athlete_code, cohortAthleteCodes:[], percentileOverrides:shared.percentileOverrides });
  const readings = shared.measurements.filter(reading => {
    if (!profileMeasurementVisible(reading, season)) return false;
    const metric = normalizePlayerMetric(reading.metric,reading.unit);
    const group = PLAYER_METRICS.find(item => item.key === metric?.key)?.group;
    const body = group === "body" || reading.source === "RENPHO";
    return reading.measured_at >= (body ? "2026-06-01" : "2026-09-01") && reading.measured_at <= "2026-12-31";
  }).sort((a,b) => b.measured_at.localeCompare(a.measured_at) || a.metric.localeCompare(b.metric));
  return <>
    <AccessPreviewNotice status={query?.preview} isPreview={!!access.preview} />
    {staff && <Link href="/roster" className="profile-back"><ArrowLeft size={15} />Team roster</Link>}
    <PlayerPerformanceProfile athlete={athlete} performance={performance} season={season}
      action={canImportPresentedAccess(access) ? <Link href="/imports" className="text-link">Import Information <ArrowRight size={15} /></Link> : undefined}
      physicalityDetails={getRenphoReports(readings,shared.batches,athlete.athlete_code).length > 0 ? <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Full RENPHO charts &amp; report history<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="border-t border-[var(--line-subtle)] px-5 py-5 sm:px-6"><RenphoCharts readings={readings} batches={shared.batches} athleteCode={athlete.athlete_code} /></div></details> : undefined}
      history={readings.length > 0 ? <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Measurement history · {readings.length} readings<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="table-wrap border-t border-[var(--line-subtle)]"><table aria-label="Shared measurement history"><thead><tr><th>Test date</th><th>Measurement</th><th>Value</th><th>Source</th></tr></thead><tbody>{readings.map(reading => <tr key={reading.id}><td className="whitespace-nowrap">{reading.measured_at}</td><td>{reading.metric}</td><td className="whitespace-nowrap tabular-nums">{reading.value} {reading.unit}</td><td>{reading.source}</td></tr>)}</tbody></table></div></details> : undefined} />
    {admin && !access.preview && <p className="mt-6 text-sm"><Link className="text-link" href={`/admin/correct-weight?athlete=${id}`}>Correct Recorded Weight</Link></p>}
    {admin && <details className="group mt-6 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Administrative roster details<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><dl className="field-grid m-0 border-t border-[var(--line-subtle)] px-5 py-5 sm:px-6"><div><dt>PAC ID</dt><dd>{athlete.athlete_code}</dd></div><div><dt>Roster email</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Roster status</dt><dd>{display(season?.roster_status)}</dd></div><div><dt>Academic class</dt><dd>{display(season?.academic_class)}</dd></div></dl></details>}
  </>;
}
