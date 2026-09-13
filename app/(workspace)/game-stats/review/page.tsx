import Link from "next/link";
import {requireImportAccess} from "@/lib/auth";
import {loadTestingRoster} from "@/lib/testing-checklist-server";
import {loadGameStats} from "@/lib/game-server";
import {loadGameLogs} from "@/lib/game-log-server";
import {reviewGameData,obpReadyCount} from "@/lib/game-review";
import {PageHeading} from "@/components/page-heading";
export default async function GameReviewPage(){
 const access=await requireImportAccess();const [stats,logs,roster]=await Promise.all([loadGameStats(access),loadGameLogs(access),loadTestingRoster()]);
 const issues=reviewGameData(stats,logs),names=new Map(roster.map(a=>[a.id,a.name])),qpa=stats.filter(s=>s.source==="qpa_fall_2026"),ids=new Set([...stats.map(s=>s.athlete_id),...logs.map(l=>l.athleteId)]),waiting=roster.filter(a=>!ids.has(a.id));
 const updated=stats.length?[...stats].sort((a,b)=>b.fetched_at.localeCompare(a.fetched_at))[0].fetched_at:null;
 return <><PageHeading section="Coaching Tools / Competition" title="Data Review" description="Missing or conflicting game counts, grouped for quick follow-up."><Link href="/game-stats/log" className="btn btn-secondary">Game Log</Link><Link href="/imports/game-stats" className="btn btn-secondary">Review Sheet Update</Link></PageHeading>
 <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Needs Review",issues.length],["Players With QPA",new Set(qpa.map(r=>r.athlete_id)).size],["OBP Ready",obpReadyCount(qpa)],["Dated Player Entries",logs.length]].map(([label,n])=><div key={label} className="panel p-4"><dt className="muted text-xs">{label}</dt><dd className="mt-2 text-3xl font-black">{n}</dd></div>)}</dl>
 <section className="panel p-5"><h2 className="text-lg font-bold">{issues.length?"Counts to Review":"Recorded Counts Check Out"}</h2><p className="muted text-sm">Correct sheet values in their source row, then use the next verified sheet update. Coach-entered games can be corrected directly.</p>{updated&&<p className="muted text-xs">Saved sheet data checked: {new Date(updated).toLocaleString("en-US",{timeZone:"America/Los_Angeles"})}</p>}
 {!!issues.length&&<ul className="mt-5 space-y-4">{issues.map(i=><li key={i.id} className="rounded-xl border border-[var(--line-subtle)] p-4"><Link href={`/athletes/${i.athleteId}`} className="font-bold">{names.get(i.athleteId)??"Player"}</Link><p className="muted mt-1 text-xs">{i.source}</p><p className="my-2 text-sm">{i.message}</p><Link href={i.href} className="text-link text-sm" {...(i.href.startsWith("https:")?{target:"_blank",rel:"noreferrer"}:{})}>{i.action}</Link></li>)}</ul>}</section>
 <details className="panel mt-5 p-5"><summary className="cursor-pointer font-semibold">Awaiting Game Data · {waiting.length} Players</summary><p className="muted mt-3 text-sm">No saved sheet counts or dated game entries yet. This does not mean a player missed a game.</p><ul className="mt-3 grid gap-2 sm:grid-cols-3">{waiting.map(a=><li key={a.id}><Link href={`/athletes/${a.id}`} className="text-link text-sm">{a.name}</Link></li>)}</ul></details></>;
}
