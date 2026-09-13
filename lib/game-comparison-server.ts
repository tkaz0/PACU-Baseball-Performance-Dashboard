import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { GAME_METRIC_COLUMNS } from "@/lib/game-import";
import { GAME_LEADERBOARD_METRICS, type GameComparison, type GameLeaderboardRow } from "@/lib/game-metrics";
type Access=Awaited<ReturnType<typeof requireAccess>>;
const fail=():never=>{throw Error("Game comparisons could not be verified.");};
const derived=new Set(["batting_avg","batting_obp","batting_hr_pct","batting_bb_pct","batting_k_pct","batting_hh_pct"]);
const fields=(item:Record<string,unknown>,keys:string[])=>Object.keys(item).sort().join()===keys.sort().join();
function base(item:unknown):Record<string,unknown>{
 if(!item||typeof item!=="object"||Array.isArray(item))return fail();const r=item as Record<string,unknown>;
 if(typeof r.source!=="string"||!Object.hasOwn(GAME_METRIC_COLUMNS,r.source)||typeof r.metric!=="string"||!(Object.hasOwn(GAME_METRIC_COLUMNS[r.source as keyof typeof GAME_METRIC_COLUMNS],r.metric)||(r.source==="qpa_fall_2026"&&derived.has(r.metric)))||typeof r.eventId!=="string"||(r.source==="qpa_fall_2026"?r.eventId!=="":!/^[A-Za-z0-9_-]{1,80}$/.test(r.eventId))||typeof r.value!=="number"||!Number.isFinite(r.value)||r.value<0||!Number.isSafeInteger(r.sampleSize)||(r.sampleSize as number)<1||(r.sampleSize as number)>1000||(r.percentile!==null&&(typeof r.percentile!=="number"||!Number.isFinite(r.percentile)||r.percentile<0||r.percentile>100))||((r.sampleSize as number)<5&&r.percentile!==null))return fail();return r;
}
export async function loadGameComparisons(access:Access,athleteId:string):Promise<GameComparison[]>{
 if(!UUID_PATTERN.test(athleteId)||!canReadPresentedAthlete(access,athleteId))throw Error("Game comparison access denied.");
 const {data,error}=await access.supabase.rpc("game_comparisons",{p_athlete_id:athleteId});if(error||!Array.isArray(data)||data.length>10000)return fail();
 const seen=new Set<string>();return data.map(item=>{const r=base(item);if(!fields(r,["source","metric","eventId","value","percentile","sampleSize","snapshotId"])||typeof r.snapshotId!=="string"||!UUID_PATTERN.test(r.snapshotId))return fail();const k=JSON.stringify([r.source,r.eventId,r.metric]);if(seen.has(k))return fail();seen.add(k);return r as GameComparison;});
}
export async function loadGameLeaderboards(access:Access):Promise<GameLeaderboardRow[]>{
 if(!access.roles.some(r=>["admin","coach","player"].includes(r)))throw Error("Game leaderboard access denied.");
 const {data,error}=await access.supabase.rpc("game_leaderboards");if(error||!Array.isArray(data)||data.length>10000)return fail();
 const seen=new Set<string>();return data.map(item=>{const r=base(item);if(!fields(r,["metric","source","eventId","playedOn","value","unit","rank","name","code","profileId","updatedAt","percentile","sampleSize"])||(r.source==="qpa_fall_2026"?!(GAME_LEADERBOARD_METRICS as readonly string[]).includes(r.metric as string):!["strike_pct","k","bb_outcome","pitches"].includes(r.metric as string))||typeof r.unit!=="string"||r.unit!==(["batting_avg","batting_obp"].includes(r.metric as string)?"avg":(r.metric as string).endsWith("pct")?"%":"count")||!Number.isSafeInteger(r.rank)||(r.rank as number)<1||(r.rank as number)>(r.sampleSize as number)||typeof r.name!=="string"||!r.name.trim()||r.name.length>201||/[\u0000-\u001f\u007f]/.test(r.name)||typeof r.code!=="string"||!/^PAC-\d{4,9}$/.test(r.code)||typeof r.updatedAt!=="string"||!Number.isFinite(Date.parse(r.updatedAt))||(r.profileId!==null&&(typeof r.profileId!=="string"||!UUID_PATTERN.test(r.profileId)))||(r.source==="qpa_fall_2026"?r.playedOn!==null:typeof r.playedOn!=="string"||!/^2026-\d{2}-\d{2}$/.test(r.playedOn)||r.playedOn<"2026-09-01"||r.playedOn>"2026-12-31"))return fail();const k=JSON.stringify([r.source,r.eventId,r.metric,r.code]);if(seen.has(k))return fail();seen.add(k);return {...r,profileId:r.profileId&&canReadPresentedAthlete(access,r.profileId as string)?r.profileId:null} as GameLeaderboardRow;});
}
