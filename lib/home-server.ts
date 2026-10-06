import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadStaffHomeSummary } from "@/lib/analytics-server";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadGameStats } from "@/lib/game-server";
import { profileMeasurementVisible } from "@/lib/player-profile-layout";
import { buildHomeSummary, type HomeSummary } from "@/lib/home-summary";
import type { VisitDigest } from "@/lib/dashboard-visit-digest";
import type { coachUpdateDigest } from "@/lib/coach-update-digest";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { buildVisitDigest, visitMetricKey } from "@/lib/dashboard-visit-digest";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
import type { RosterAthlete } from "@/lib/types";
import { validateHomeCoverage } from "@/lib/home-coverage";
import { loadDesignAthleteChoices } from "@/lib/staff-athlete-search-server";
import { seasonDesignNavigation } from "@/lib/design-navigation";

/** Initial Home needs coverage metadata, not numerical measurement history. */
export async function loadHomeSnapshot(access:Awaited<ReturnType<typeof requireAccess>>,onFallback?:(reason:string)=>void) {
  try { return await loadCompactHomeSnapshot(access); }
  catch(error) {
    // The compact reader is an optimization; the original reader keeps Home available if it fails.
    const reason=error instanceof Error?error.message.slice(0,160):"unknown error";
    console.error("Home compact summary failed; using the original reader:",reason);
    onFallback?.(reason);
    return loadHomeSummary(access);
  }
}

async function loadCompactHomeSnapshot(access:Awaited<ReturnType<typeof requireAccess>>) {
  const staff=canImportPresentedAccess(access), athleteId=staff?null:access.athleteId;
  if(!staff&&!athleteId)return null;
  let season: RosterAthlete["athlete_seasons"][number] | undefined;
  if(athleteId){
    const {data,error}=await access.supabase.from("athletes").select("id,athlete_seasons(*)").eq("id",athleteId).maybeSingle();
    if(error||!data||data.id!==athleteId||!Array.isArray(data.athlete_seasons))throw new Error("Your home summary could not be loaded.");
    season=(data.athlete_seasons as RosterAthlete["athlete_seasons"]).find(s=>s.season==="2026-27");
  }
  const today=pacificTestingDate();
  const [coverage,games,positionPlayers]=await Promise.all([
    access.supabase.rpc("home_measurement_summary",{p_athlete_id:athleteId}),
    loadGameStats(access,athleteId??undefined),
    staff?loadDesignAthleteChoices(access,"swing"):Promise.resolve([]),
  ]);
  if(coverage.error){
    // Log only the database status code; never source rows or private payloads.
    const code=typeof coverage.error.code==="string"&&/^[A-Z0-9]{5,10}$/.test(coverage.error.code)?coverage.error.code:"unknown";
    throw new Error(`Home coverage could not be loaded (${code}). Refresh to try again.`);
  }
  const compact=validateHomeCoverage(coverage.data,athleteId,today);
  const groups=staff?compact.groups:compact.groups.filter(row=>profileMeasurementVisible(row,season));
  const positionIds=staff?positionPlayers.map(player=>player.id):seasonDesignNavigation(season).swing?[athleteId!]:[];
  return buildHomeSummary(compact.playerIds,groups,games,today,positionIds);
}

/** Detailed change detection streams separately and retains its original rules. */
export async function loadHomeActivity(access:Awaited<ReturnType<typeof requireAccess>>,visit:DashboardVisitWindow){
  try {
    const summary=await loadHomeSummary(access,visit);
    return {ok:true as const,visitDigest:summary&&"visitDigest" in summary?summary.visitDigest:undefined,
      coachDigest:summary&&"coachDigest" in summary?summary.coachDigest:undefined};
  }catch{return {ok:false as const};}
}

export async function loadHomeSummary(access:Awaited<ReturnType<typeof requireAccess>>,visit?:DashboardVisitWindow):Promise<(HomeSummary & {visitDigest?:VisitDigest;coachDigest?:ReturnType<typeof coachUpdateDigest>})|null> {
  if(canImportPresentedAccess(access))return visit?loadStaffHomeSummary(visit):loadStaffHomeSummary();
  if(!access.athleteId)return null;
  // Presented athlete is applied before any query, including Admin-as-Player.
  const {data,error}=await access.supabase.from("athletes").select("id,athlete_code,athlete_seasons(*)").eq("id",access.athleteId).maybeSingle();
  if(error||!data||data.id!==access.athleteId)throw new Error("Your home summary could not be loaded.");
  const athlete=data as Pick<RosterAthlete,"id"|"athlete_code"|"athlete_seasons">;
  const season=athlete.athlete_seasons.find(s=>s.season==="2026-27");
  const [performance,games]=await Promise.all([loadAthletePerformance(access,athlete,{includePercentiles:false}),loadGameStats(access,athlete.id)]);
  const batches=new Map(performance.batches.map(b=>[b.id,b.importedAt]));
  const readings=performance.measurements.filter(r=>profileMeasurementVisible(r,season)).map(r=>({athleteId:athlete.id,source:r.source,date:r.measured_at,importedAt:batches.get(r.batch_id)!}));
  const summary=buildHomeSummary([athlete.id],readings,games,pacificTestingDate(),seasonDesignNavigation(season).swing?[athlete.id]:[]);
  if(!visit)return summary;
  const activity=performance.measurements.filter(r=>profileMeasurementVisible(r,season)).map(r=>({id:r.id,athleteId:athlete.id,metric:visitMetricKey(r.metric,r.unit),label:r.metric,unit:r.unit,value:r.value,source:r.source,date:r.measured_at,importedAt:batches.get(r.batch_id)!}));
  const player={id:athlete.id,playerType:season?.player_type,position:season?.primary_position,secondaryPosition:season?.secondary_position};
  return {...summary,visitDigest:buildVisitDigest([player],activity,games,visit,pacificTestingDate())};
}
