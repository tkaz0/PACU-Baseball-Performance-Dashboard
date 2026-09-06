import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { GAME_METRIC_COLUMNS } from "@/lib/game-import";
import type { GameSourceKey } from "@/lib/game-source";

type Access=Awaited<ReturnType<typeof requireAccess>>;
export type SharedGameStat={source:GameSourceKey;athlete_id:string;metric:string;value:number;unit:"count"|"%";scope:"cumulative_fall"|"pitching_event";event_id:string|null;played_on:string|null;source_row:number;source_column:number;derived_from:number[];snapshot_id:string;fetched_at:string;content_hash:string};
const expectedFields=["source","athlete_id","metric","value","unit","scope","event_id","played_on","source_row","source_column","derived_from","snapshot_id","fetched_at","content_hash"].sort().join(",");
export async function loadGameStats(access:Access,athleteId?:string):Promise<SharedGameStat[]> {
  const staff=access.roles.some(role=>role==="admin"||role==="coach");
  const requested=athleteId??(!staff?access.athleteId:null);
  if((!staff&&!requested)||(requested&&(!UUID_PATTERN.test(requested)||!canReadPresentedAthlete(access,requested))))throw new Error("Game statistics access denied.");
  const {data,error}=await access.supabase.rpc("read_game_stats",{p_athlete_id:requested??null});
  if(error||!Array.isArray(data)||data.length>10000)throw new Error("Game statistics could not be loaded.");
  const seen=new Set<string>();
  return data.map(row=>{
    const invalid=()=>{throw new Error("Game statistics access or format could not be verified.");};
    if(!row||typeof row!=="object"||Array.isArray(row)||Object.keys(row).sort().join(",")!==expectedFields||typeof row.source!=="string"||!Object.hasOwn(GAME_METRIC_COLUMNS,row.source)||typeof row.athlete_id!=="string"||!UUID_PATTERN.test(row.athlete_id)||!canReadPresentedAthlete(access,row.athlete_id)||(requested&&row.athlete_id!==requested)||typeof row.metric!=="string"||!Object.hasOwn(GAME_METRIC_COLUMNS[row.source as GameSourceKey],row.metric)||typeof row.value!=="number"||!Number.isFinite(row.value)||row.value<0||typeof row.fetched_at!=="string"||!Number.isFinite(Date.parse(row.fetched_at))||Date.parse(row.fetched_at)>Date.now()+300000||typeof row.snapshot_id!=="string"||!UUID_PATTERN.test(row.snapshot_id)||typeof row.content_hash!=="string"||row.content_hash.length!==64||!/^[a-f0-9]{64}$/.test(row.content_hash)||!Number.isSafeInteger(row.source_row)||row.source_row<2||row.source_row>2000||row.source_column!==GAME_METRIC_COLUMNS[row.source as GameSourceKey][row.metric])return invalid();
    const qpa=row.source==="qpa_fall_2026",rate=row.metric==="qpa_pct"||row.metric==="strike_pct";
    if(row.unit!==(rate?"%":"count")||(rate?row.value>100:!Number.isSafeInteger(row.value)||row.value>1000000000)||JSON.stringify(row.derived_from)!==JSON.stringify(rate?(qpa?[3,2]:[4,3]):[]))return invalid();
    if(qpa?row.scope!=="cumulative_fall"||row.event_id!==null||row.played_on!==null:row.scope!=="pitching_event"||typeof row.event_id!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(row.event_id)||typeof row.played_on!=="string"||!/^2026-\d{2}-\d{2}$/.test(row.played_on)||!Number.isFinite(Date.parse(row.played_on))||new Date(row.played_on).toISOString().slice(0,10)!==row.played_on||row.played_on<"2026-09-01"||row.played_on>"2026-12-31")return invalid();
    const key=JSON.stringify([row.source,row.athlete_id,row.event_id,row.metric]);if(seen.has(key))throw new Error("Game statistics contain duplicate observations.");seen.add(key);
    return row as SharedGameStat;
  });
}
