import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { display, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { loadAthletePerformance } from "@/lib/performance-server";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { getPlayerPerformance, normalizePlayerMetric, PLAYER_METRICS } from "@/lib/player-performance";
import { getRenphoReports } from "@/lib/renpho-charts";
import { RenphoCharts } from "@/components/renpho-charts";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";

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
      physicalityDetails={getRenphoReports(readings,shared.batches,athlete.athlete_code).length > 0 ? <details className="panel"><summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Full RENPHO charts &amp; report history</summary><div className="px-5 pb-5 sm:px-6"><RenphoCharts readings={readings} batches={shared.batches} athleteCode={athlete.athlete_code} /></div></details> : undefined}
      history={readings.length > 0 ? <details className="panel"><summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Measurement history · {readings.length} readings</summary><div className="table-wrap px-5 pb-5"><table aria-label="Shared measurement history"><thead><tr><th>Test date</th><th>Measurement</th><th>Value</th><th>Source</th></tr></thead><tbody>{readings.map(reading => <tr key={reading.id}><td>{reading.measured_at}</td><td>{reading.metric}</td><td>{reading.value} {reading.unit}</td><td>{reading.source}</td></tr>)}</tbody></table></div></details> : undefined} />
    {admin && <details className="panel mt-6"><summary className="cursor-pointer px-5 py-5 text-sm font-bold sm:px-6">Administrative roster details</summary><dl className="field-grid px-5 pb-6"><div><dt>Athlete ID</dt><dd>{athlete.athlete_code}</dd></div><div><dt>Roster email</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Roster status</dt><dd>{display(season?.roster_status)}</dd></div><div><dt>Academic class</dt><dd>{display(season?.academic_class)}</dd></div></dl></details>}
  </>;
}
