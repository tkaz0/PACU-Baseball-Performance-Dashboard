import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { WEEKLY_SOURCES, weeklySource, parseWeeklySourceChecks, type WeeklySource, type WeeklySourceCheck, type WeeklySourceStatus } from "@/lib/weekly-source-contract";
export async function loadWeeklySourceChecks(access:Awaited<ReturnType<typeof requireAccess>>):Promise<WeeklySourceCheck[]> {
  if(!canImportPresentedAccess(access))return [];
  const {data,error}=await access.supabase.from("weekly_source_checks").select("source,outcome,checked_at").order("source").limit(4);
  if(error)throw new Error("Weekly source status could not be loaded.");
  return parseWeeklySourceChecks(data);
}
export async function loadWeeklySourceStatus(access:Awaited<ReturnType<typeof requireAccess>>):Promise<WeeklySourceStatus[]> {
  if(!canImportPresentedAccess(access))return [];
  const [checks, sync, metrics]=await Promise.all([
    loadWeeklySourceChecks(access),
    access.supabase.from("game_sync_state").select("source,snapshot_id").limit(3),
    access.supabase.from("performance_measurements").select("imported_at").eq("source","Player Metrics").gte("measured_at","2026-09-01").order("imported_at",{ascending:false}).limit(1),
  ]);
  if(sync.error||metrics.error||!Array.isArray(sync.data)||sync.data.length>2||!Array.isArray(metrics.data)||metrics.data.length>1)throw new Error("Weekly source save dates could not be loaded.");
  const snapshotIds=sync.data.map(row=>row.snapshot_id);
  if(sync.data.some(row=>!weeklySource(row.source)||row.source==="player_metrics"||typeof row.snapshot_id!=="string")||new Set(snapshotIds).size!==snapshotIds.length)throw new Error("Weekly source save dates could not be verified.");
  const snapshots=snapshotIds.length?await access.supabase.from("game_stat_snapshots").select("id,source,created_at").in("id",snapshotIds).limit(3):{data:[],error:null};
  if(snapshots.error||!Array.isArray(snapshots.data)||snapshots.data.length!==snapshotIds.length)throw new Error("Weekly source save dates could not be verified.");
  const dates=new Map<WeeklySource,string>();
  for(const row of snapshots.data){
    if(!snapshotIds.includes(row.id)||!weeklySource(row.source)||row.source==="player_metrics"||typeof row.created_at!=="string"||!Number.isFinite(Date.parse(row.created_at)))throw new Error("Weekly source save dates could not be verified.");
    dates.set(row.source,row.created_at);
  }
  if(metrics.data[0]){
    const saved=metrics.data[0].imported_at;
    if(typeof saved!=="string"||!Number.isFinite(Date.parse(saved)))throw new Error("Weekly source save dates could not be verified.");
    dates.set("player_metrics",saved);
  }
  return WEEKLY_SOURCES.map(({key})=>{const check=checks.find(row=>row.source===key);return {source:key,outcome:check?.outcome??null,checkedAt:check?.checkedAt??null,savedAt:dates.get(key)??null};});
}
