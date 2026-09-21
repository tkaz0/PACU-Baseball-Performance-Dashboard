import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadStaffHomeSummary } from "@/lib/analytics-server";
import { loadAthletePerformance } from "@/lib/performance-server";
import { loadGameStats } from "@/lib/game-server";
import { profileMeasurementVisible } from "@/lib/player-profile-layout";
import { buildHomeSummary } from "@/lib/home-summary";
import { pacificTestingDate } from "@/lib/testing-checklist";
import type { RosterAthlete } from "@/lib/types";

export async function loadHomeSummary(access:Awaited<ReturnType<typeof requireAccess>>) {
  if(canImportPresentedAccess(access))return loadStaffHomeSummary();
  if(!access.athleteId)return null;
  // Presented athlete is applied before any query, including Admin-as-Player.
  const {data,error}=await access.supabase.from("athletes").select("id,athlete_code,athlete_seasons(*)").eq("id",access.athleteId).maybeSingle();
  if(error||!data||data.id!==access.athleteId)throw new Error("Your home summary could not be loaded.");
  const athlete=data as Pick<RosterAthlete,"id"|"athlete_code"|"athlete_seasons">;
  const season=athlete.athlete_seasons.find(s=>s.season==="2026-27");
  const [performance,games]=await Promise.all([loadAthletePerformance(access,athlete),loadGameStats(access,athlete.id)]);
  const batches=new Map(performance.batches.map(b=>[b.id,b.importedAt]));
  const readings=performance.measurements.filter(r=>profileMeasurementVisible(r,season)).map(r=>({athleteId:athlete.id,source:r.source,date:r.measured_at,importedAt:batches.get(r.batch_id)!}));
  return buildHomeSummary([athlete.id],readings,games,pacificTestingDate());
}
