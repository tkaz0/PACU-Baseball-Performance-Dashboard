import { profileDetail, profileTab } from "@/lib/profile-tab";
import { loadSwingVideos } from "@/lib/swing-videos-server";
import { prepareSwingVideo, finishSwingVideo, playSwingVideo } from "./video-actions";
import { loadTrendAnnotations } from "@/lib/trend-annotations-server";
import { TrendAnnotations } from "@/components/trend-annotations";
import { loadTrainingBlockCounts } from "@/lib/training-blocks-server";
import { buildTrainingBlockSeries } from "@/lib/training-blocks";
import { TrainingBlockComparison } from "@/components/training-block-comparison";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { pitchSourceLabel } from "@/lib/pitch-display";
import { MovementScreening } from "@/components/movement-screening";
import { loadMovementScreening } from "@/lib/movement-server";
import { loadHittingTeamAverages } from "@/lib/hitting-team-server";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { ClassifiedPitchResults } from "@/components/classified-pitch-results";
import { HitterContactMap } from "@/components/hitter-contact-map";
import { loadFullSwingContacts } from "@/lib/full-swing-contacts-server";
import { formatSourceNumber } from "@/lib/measurement-display";
import { loadGameLogs } from "@/lib/game-log-server";
import { PlayerGameLog } from "@/components/player-game-log";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { loadGameStats } from "@/lib/game-server";
import { RenphoMuscleBalance } from "@/components/renpho-muscle-balance";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, FileText } from "lucide-react";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { display, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { loadAthletePerformance } from "@/lib/performance-server";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { loadPlayerFallSummaries } from "@/lib/player-fall-summaries-server";
import { getPlayerPerformance, normalizePlayerMetric, PLAYER_METRICS } from "@/lib/player-performance";
import { getRenphoReports } from "@/lib/renpho-charts";
import { RenphoCharts } from "@/components/renpho-charts";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { loadAthleteHeadshot } from "@/lib/headshots-server";
import { profileMeasurementVisible, profileShowsHitting, profileShowsPitching } from "@/lib/player-profile-layout";

export default async function Profile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ preview?: string; focus?: string; goal?: string; tab?: string | string[]; detail?: string | string[] }> }) {
  const access = await requireAccess();
  const { supabase, roles } = access;
  const { id } = await params;
  if (!UUID_PATTERN.test(id) || !canReadPresentedAthlete(access, id)) notFound();
  const query = await searchParams;
  const selectedTab = profileTab(query?.tab);
  const detail = profileDetail(query?.detail);
  const contactTab = selectedTab === "in-game" || selectedTab === "practice";
  const annotatedTab = selectedTab !== "overview";
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this athlete profile.");
  if (!data) notFound();
  const athlete = data as RosterAthlete;
  const seasons = [...athlete.athlete_seasons].sort((a,b) => b.season.localeCompare(a.season));
  const season = seasons.find(item => item.season === "2026-27") ?? seasons[0];
  const staff = roles.includes("admin") || roles.includes("coach");
  const admin = roles.includes("admin");
  const showHitting = profileShowsHitting(season);
  const today = pacificTestingDate();
  const videoActions = { prepare: prepareSwingVideo, finish: finishSwingVideo, play: playSwingVideo };
  // Independent readers start together after the exact player passes live authorization.
  const sharedPromise = loadAthletePerformance(access,athlete);
  const [gameLogs, gameStats, gameComparisons, shared, teamAverages, movement, contacts, videos, annotations, blockCounts, headshot, fallSummaries] = await Promise.all([
    staff && selectedTab === "in-game" ? loadGameLogs(access, athlete.id) : Promise.resolve([]),
    selectedTab === "overview" || selectedTab === "in-game" ? loadGameStats(access, athlete.id) : Promise.resolve([]),
    selectedTab === "overview" || selectedTab === "in-game" ? loadGameComparisons(access, athlete.id) : Promise.resolve([]),
    sharedPromise, showHitting && selectedTab !== "progress" ? loadHittingTeamAverages(access) : Promise.resolve([]),
    selectedTab === "physicality" && detail === "full" ? loadMovementScreening(access,athlete.id,athlete.athlete_code) : Promise.resolve(null),
    showHitting && contactTab ? loadFullSwingContacts(access,athlete.id, selectedTab === "practice" ? "practice" : "in_game") : Promise.resolve([]),
    showHitting && contactTab ? loadSwingVideos(access,athlete.id).catch(()=>null) : Promise.resolve([]),
    annotatedTab ? loadTrendAnnotations(access,athlete.id).catch(()=>null) : Promise.resolve([]),
    selectedTab === "progress" ? loadTrainingBlockCounts(access,athlete.id).catch(()=>null) : Promise.resolve([]),
    loadAthleteHeadshot(access,athlete.id),
    // Fall best / reading-weighted Fall averages match the leaderboards; on failure cards keep latest-session values.
    showHitting && selectedTab !== "progress" && selectedTab !== "physicality" ? sharedPromise.then(data=>loadPlayerFallSummaries(access,athlete.athlete_code,data.measurements)).catch(()=>[]) : Promise.resolve([]),
  ]);
  const performance = getPlayerPerformance({ readings:shared.measurements, batches:shared.batches, athleteCode:athlete.athlete_code, cohortAthleteCodes:[], percentileOverrides:shared.percentileOverrides, fallSummaries });
  const readings = shared.measurements.filter(reading => {
    if (!profileMeasurementVisible(reading, season)) return false;
    const metric = normalizePlayerMetric(reading.metric,reading.unit);
    const group = PLAYER_METRICS.find(item => item.key === metric?.key)?.group;
    const body = group === "body" || reading.source === "RENPHO";
    return reading.measured_at >= (body ? "2026-06-01" : "2026-09-01") && reading.measured_at <= "2026-12-31";
  }).sort((a,b) => b.measured_at.localeCompare(a.measured_at) || a.metric.localeCompare(b.metric));
  return <>
    <AccessPreviewNotice status={query?.preview} isPreview={!!access.preview} />
    <div className="profile-toolbar">{staff ? <Link href="/roster" className="profile-back"><ArrowLeft size={15} />Team Roster</Link> : <span/>}<div className="flex flex-wrap items-center gap-2">{canImportPresentedAccess(access) && <Link href="/imports" className="btn btn-secondary">Import Results<ArrowRight size={15} aria-hidden="true"/></Link>}<Link prefetch={false} href={`/athletes/${athlete.id}/report`} className="btn btn-secondary"><FileText size={15} aria-hidden="true"/>Player Report</Link></div></div>
    <PlayerPerformanceProfile detail={detail} selectedTab={selectedTab} navigationPath={`/athletes/${athlete.id}`}
      headshot={headshot}
      trainingBlocks={<>{blockCounts===null&&<p role="status" className="muted text-sm">Swing counts are temporarily unavailable. Some session averages cannot be compared yet.</p>}<TrainingBlockComparison series={buildTrainingBlockSeries(readings,{athleteCode:athlete.athlete_code,showHitting,showPitching:profileShowsPitching(season),today,readingCounts:blockCounts??[]})}/></>}
      trendAnnotations={annotations ?? []}
      trendNotes={annotations ? <TrendAnnotations items={annotations} athleteId={athlete.id} staff={canImportPresentedAccess(access)} today={today}/> : <p role="status" className="muted text-sm">Coaching notes are temporarily unavailable. Refresh to try again.</p>}
      pitchDesignHref={`/pitch-design?athlete=${athlete.id}`} swingDesignHref={`/swing-design?athlete=${athlete.id}`} teamAverages={teamAverages} blastReadings={shared.measurements} timelineReadings={readings} practicePitchResults={<ClassifiedPitchResults readings={shared.measurements} context="practice" quick={detail === "quick"} />} pitchResults={<ClassifiedPitchResults readings={shared.measurements} quick={detail === "quick"} />} contactResults={<HitterContactMap contacts={contacts} context="in_game" bats={season?.bats} athleteId={athlete.id} videoActions={videoActions} videos={videos??[]} canAttachVideo={videos!==null&&canImportPresentedAccess(access)} videosAvailable={videos!==null} />} practiceContactResults={<HitterContactMap contacts={contacts} context="practice" bats={season?.bats} athleteId={athlete.id} videoActions={videoActions} videos={videos??[]} canAttachVideo={videos!==null&&canImportPresentedAccess(access)} videosAvailable={videos!==null} />} simplified={!staff} overviewGameStats={gameStats} gameComparisons={gameComparisons} gameStats={<><AthleteGameStats stats={gameStats} comparisons={gameComparisons} showDetails={staff && detail === "full"}/>{staff&&<PlayerGameLog logs={gameLogs}/>}</>} athlete={athlete} performance={performance} season={season}
      movementScreening={<MovementScreening report={movement} showReferences={staff}/>}
      muscleBalance={<RenphoMuscleBalance report={getRenphoReports(readings,shared.batches,athlete.athlete_code)[0]} />}
      physicalityDetails={detail === "full" && selectedTab === "physicality" && staff && getRenphoReports(readings,shared.batches,athlete.athlete_code).length > 0 ? <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">RENPHO Reports<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="border-t border-[var(--line-subtle)] px-5 py-5 sm:px-6"><RenphoCharts readings={readings} batches={shared.batches} athleteCode={athlete.athlete_code} /></div></details> : undefined}
      history={detail === "full" && selectedTab === "progress" && staff && readings.length > 0 ? <details className="group rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Measurement History · {readings.length} readings<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div className="table-wrap border-t border-[var(--line-subtle)]"><table aria-label="Shared measurement history"><thead><tr><th>Test Date</th><th>Measurement</th><th>Value</th><th>Source</th></tr></thead><tbody>{readings.map(reading => <tr key={reading.id}><td className="whitespace-nowrap">{reading.measured_at}</td><td>{profileMetricLabel(normalizePlayerMetric(reading.metric,reading.unit)?.key??"",reading.metric,reading.source)}</td><td className="whitespace-nowrap tabular-nums">{formatSourceNumber(reading.value, reading.source)} {reading.unit}</td><td>{pitchSourceLabel(reading.source)}</td></tr>)}</tbody></table></div></details> : undefined} />
    {admin && !access.preview && <p className="mt-6 text-sm"><Link className="text-link" href={`/admin/correct-weight?athlete=${id}`}>Correct Recorded Weight</Link><span className="mx-3 text-[var(--text-secondary)]">·</span><Link className="text-link" href={`/admin/csv-corrections?athlete=${id}`}>Correct CSV Assignments</Link></p>}
    {admin && <details className="group mt-6 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold sm:px-6">Roster Details<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><dl className="field-grid m-0 border-t border-[var(--line-subtle)] px-5 py-5 sm:px-6"><div><dt>PAC ID</dt><dd>{athlete.athlete_code}</dd></div><div><dt>Roster email</dt><dd>{display(athlete.pacific_email)}</dd></div><div><dt>Roster status</dt><dd>{display(season?.roster_status)}</dd></div><div><dt>Academic class</dt><dd>{display(season?.academic_class)}</dd></div></dl></details>}
  </>;
}
