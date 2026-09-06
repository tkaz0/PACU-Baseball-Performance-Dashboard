import type { GameSourceKey, GameSourceObservation } from "@/lib/game-source";

export type SharedGameObservation = Omit<GameSourceObservation,"label"|"source">;
export type SharedGameImport = { source:GameSourceKey; contentHash:string; fetchedAt:string; observations:SharedGameObservation[] };
export const GAME_METRIC_COLUMNS: Record<GameSourceKey,Record<string,number>> = {
  qpa_fall_2026:{pa:2,qpa:3,ab:5,hh_base_hit:9,hh_extra_base_hit:10,pumps:11,base_hit:12,three_eight_hh:13,eight_plus_pitches:14,bb:15,rbi:16,sac_bunt:17,moving_runner:18,hbp:19,punchies:20,ab_control:23,qpa_pct:8},
  pitching_fall_2026:{pitches:3,strikes:4,fb:6,fb_k:7,bb_pitch_family:9,bb_pitch_family_k:10,ch:12,ch_k:13,baf:15,fps:16,h:19,r:20,bb_outcome:21,hbp:22,k:23,strike_pct:5},
};
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
export function validateGameImport(value:unknown,now=Date.now()):SharedGameImport {
  const fail=():never=>{throw new Error("Review the game snapshot's source, athletes, dates and counts before syncing. No saved game statistics changed.");};
  if(!isObject(value)||(value.source!=="qpa_fall_2026"&&value.source!=="pitching_fall_2026")||typeof value.contentHash!=="string"||value.contentHash.length!==64||!/^[a-f0-9]{64}$/.test(value.contentHash)||typeof value.fetchedAt!=="string"||!Number.isFinite(Date.parse(value.fetchedAt))||!Array.isArray(value.observations)||value.observations.length<1||value.observations.length>10000) return fail();
  if(Date.parse(value.fetchedAt)>now+5*60*1000||Date.parse(value.fetchedAt)<Date.parse("2026-09-12T00:00:00-07:00"))return fail();
  const source:GameSourceKey=value.source, qpa=source==="qpa_fall_2026",seen=new Set<string>();
  const observations:SharedGameObservation[]=value.observations.map(item=>{
    if(!isObject(item)||typeof item.athleteCode!=="string"||!/^PAC-[0-9]{4,9}$/.test(item.athleteCode)||typeof item.metric!=="string"||!Object.hasOwn(GAME_METRIC_COLUMNS[source],item.metric)||typeof item.value!=="number"||!Number.isFinite(item.value)||item.value<0||!Number.isSafeInteger(item.sourceRow)||(item.sourceRow as number)<2||(item.sourceRow as number)>2000||item.sourceColumn!==GAME_METRIC_COLUMNS[source][item.metric]) return fail();
    const rate=item.metric==="qpa_pct"||item.metric==="strike_pct";
    if(item.unit!==(rate?"%":"count")||(rate?item.value>100:!Number.isSafeInteger(item.value)||item.value>1000000000)||!Array.isArray(item.derivedFrom)||JSON.stringify(item.derivedFrom)!==JSON.stringify(rate?(qpa?[3,2]:[4,3]):[])) return fail();
    if(qpa ? item.scope!=="cumulative_fall"||item.eventId!==null||item.playedOn!==null : item.scope!=="pitching_event"||typeof item.eventId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(item.eventId)||typeof item.playedOn!=="string"||!/^2026-\d{2}-\d{2}$/.test(item.playedOn)||!Number.isFinite(Date.parse(item.playedOn))||new Date(item.playedOn).toISOString().slice(0,10)!==item.playedOn||item.playedOn<"2026-09-01"||item.playedOn>"2026-12-31") return fail();
    const identity=JSON.stringify([item.athleteCode,item.eventId,item.metric]);if(seen.has(identity))return fail();seen.add(identity);
    return {athleteCode:item.athleteCode,metric:item.metric,value:item.value,unit:rate?"%":"count",scope:qpa?"cumulative_fall":"pitching_event",eventId:item.eventId as string|null,playedOn:item.playedOn as string|null,sourceRow:item.sourceRow as number,sourceColumn:item.sourceColumn as number,derivedFrom:[...item.derivedFrom]};
  });
  for(const item of observations.filter(row=>row.unit==="%")){
    const numerator=observations.find(row=>row.athleteCode===item.athleteCode&&row.eventId===item.eventId&&row.metric===(qpa?"qpa":"strikes"));
    const denominator=observations.find(row=>row.athleteCode===item.athleteCode&&row.eventId===item.eventId&&row.metric===(qpa?"pa":"pitches"));
    if(!numerator||!denominator||numerator.sourceRow!==item.sourceRow||denominator.sourceRow!==item.sourceRow||denominator.value<=0||numerator.value>denominator.value||item.value!==100*(numerator.value/denominator.value)) return fail();
  }
  const checked:SharedGameImport={source,contentHash:value.contentHash,fetchedAt:value.fetchedAt,observations};
  if(new TextEncoder().encode(JSON.stringify(checked)).byteLength>1024*1024) return fail();
  return checked;
}
