import { loadGameLogs } from "@/lib/game-log-server";
import { PlayerGameLog } from "@/components/player-game-log";
import { loadGameComparisons } from "@/lib/game-comparison-server";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadGameStats } from "@/lib/game-server";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { PageHeading } from "@/components/page-heading";
export default async function GameStatsPage(){
  const access=await requireAccess(),stats=await loadGameStats(access);
  const logs=await loadGameLogs(access);
  const staff=canImportPresentedAccess(access);
  const ids=[...new Set([...stats.map(row=>row.athlete_id),...logs.map(row=>row.athleteId)])];
  let names=new Map<string,string>();
  if(ids.length){const {data,error}=await access.supabase.from("athletes").select("id,first_name,last_name").in("id",ids);if(error)throw new Error("Game roster could not be loaded.");names=new Map((data??[]).map(a=>[a.id,`${a.first_name} ${a.last_name}`]));}
  const comparisons=new Map(await Promise.all(ids.map(async id=>[id,await loadGameComparisons(access,id)] as const)));
  return <><PageHeading section="Pacific Baseball / Competition" title="Game Stats" description="Fall 2026 · Recorded QPA and pitching statistics from the team sheets.">{staff&&<><Link href="/game-stats/log" className="btn btn-primary">Game Log</Link><Link href="/game-stats/review" className="btn btn-secondary">Data Review</Link></>}</PageHeading>{!ids.length?<AthleteGameStats stats={[]}/>:ids.map(id=><div key={id}><h2 className="mt-6 text-xl font-bold"><Link href={`/athletes/${id}`}>{names.get(id)??"Athlete"}</Link></h2><AthleteGameStats stats={stats.filter(row=>row.athlete_id===id)} comparisons={comparisons.get(id)}/><PlayerGameLog logs={logs.filter(l=>l.athleteId===id)}/></div>)}</>;
}
