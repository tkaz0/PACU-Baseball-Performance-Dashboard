import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadGameStats } from "@/lib/game-server";
import { AthleteGameStats } from "@/components/athlete-game-stats";
import { PageHeading } from "@/components/page-heading";
export default async function GameStatsPage(){
  const access=await requireAccess(),stats=await loadGameStats(access);
  const staff=canImportPresentedAccess(access);
  const ids=[...new Set(stats.map(row=>row.athlete_id))];
  let names=new Map<string,string>();
  if(ids.length){const {data,error}=await access.supabase.from("athletes").select("id,first_name,last_name").in("id",ids);if(error)throw new Error("Game roster could not be loaded.");names=new Map((data??[]).map(a=>[a.id,`${a.first_name} ${a.last_name}`]));}
  return <><PageHeading section="Pacific Baseball / Competition" title="Game Stats" description="Fall 2026 · Recorded QPA and pitching statistics from the approved team sheets."/>{staff&&<Link href="/imports/game-stats" className="btn btn-secondary mb-5">Review Game Snapshot</Link>}{!ids.length?<AthleteGameStats stats={[]}/>:ids.map(id=><div key={id}><h2 className="mt-6 text-xl font-bold"><Link href={`/athletes/${id}`}>{names.get(id)??"Athlete"}</Link></h2><AthleteGameStats stats={stats.filter(row=>row.athlete_id===id)}/></div>)}</>;
}
