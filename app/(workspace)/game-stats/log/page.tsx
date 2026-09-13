import Link from "next/link";
import {notFound} from "next/navigation";
import {requireImportAccess} from "@/lib/auth";
import {loadTestingRoster} from "@/lib/testing-checklist-server";
import {loadGameLogs} from "@/lib/game-log-server";
import {pacificGameDate} from "@/lib/game-log";
import {GameLogEntry} from "@/components/game-log-entry";
import {PageHeading} from "@/components/page-heading";
export default async function GameLogPage({searchParams}:{searchParams:Promise<{edit?:string;new?:string}>}){
 const access=await requireImportAccess();const [athletes,logs,query]=await Promise.all([loadTestingRoster(),loadGameLogs(access),searchParams]);
 const initial=query.edit?logs.find(l=>l.id===query.edit):undefined;if(query.edit&&!initial)notFound();
 const names=new Map(athletes.map(a=>[a.id,a.name]));
 return <><PageHeading section="Coaching Tools / Competition" title="Game Log" description="Record a dated result for one player. Keep each doubleheader game separate."><Link href="/game-stats/review" className="btn btn-secondary">Data Review</Link><Link href="/game-stats" className="btn btn-secondary">Game Stats</Link></PageHeading>
 {(query.new||query.edit||!logs.length)?<GameLogEntry key={initial?.id??"new"} athletes={athletes} today={pacificGameDate()} initial={initial}/>:<Link href="/game-stats/log?new=1" className="btn btn-primary mb-5">Add Game Result</Link>}
 {!!logs.length&&<section className="panel mt-6 p-5"><h2 className="text-lg font-bold">Recorded Games · {logs.length} Player Entries</h2><div className="table-wrap"><table aria-label="Coach game log"><thead><tr><th>Date</th><th>Opponent</th><th>Player</th><th>Game</th><th>Review</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td className="whitespace-nowrap">{l.playedOn}</td><td>{l.opponent}</td><th scope="row"><Link href={`/athletes/${l.athleteId}`}>{names.get(l.athleteId)??"Player"}</Link></th><td>{l.gameNumber}{l.kind==="intrasquad"?" · Intrasquad":""}</td><td><Link className="text-link" href={`/game-stats/log?edit=${l.id}`}>Review / Correct</Link></td></tr>)}</tbody></table></div></section>}</>;
}
