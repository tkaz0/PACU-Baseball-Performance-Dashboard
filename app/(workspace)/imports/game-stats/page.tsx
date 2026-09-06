import { UUID_PATTERN } from "@/lib/types";
import { requireImportAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { GameSnapshotImport } from "@/components/game-snapshot-import";
import { GameSheetStatus } from "@/components/game-sheet-status";
import { importGameSnapshot } from "./actions";
export default async function GameImportPage({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
 const access=await requireImportAccess(),params=await searchParams;
 const {data,error}=await access.supabase.from("athletes").select("athlete_code,first_name,last_name,athlete_seasons!inner(season)",{count:"exact"}).eq("athlete_seasons.season","2026-27").order("last_name").limit(1001);
 if(error||!data||data.length>1000)throw new Error("The current shared roster could not be loaded.");
 let processed=false;
 if(typeof params.saved==="string"&&UUID_PATTERN.test(params.saved)){const receipt=await access.supabase.from("game_stat_snapshots").select("id").eq("id",params.saved).maybeSingle();processed=!receipt.error&&receipt.data?.id===params.saved;}
 const messages:Record<string,string>={review:"Review and confirm this snapshot before syncing.",input:"The snapshot needs valid athletes, dates, counts and source evidence. The previous statistics remain saved.",save:"The snapshot could not be confirmed. Keep the prepared file and review source changes or sign in again before retrying."};
 return <><PageHeading section="Pacific Baseball / Information Import" title="Game Sheet Sync" description="Only the two approved Fall 2026 tabs. No source-sheet changes."/><GameSheetStatus/>{params.error&&Object.hasOwn(messages,params.error)&&<p role="alert" className="notice notice-error my-4">{messages[params.error]}</p>}{processed&&<p role="status" className="notice my-4">The reviewed game snapshot was processed. Repeated versions do not duplicate statistics.</p>}<div className="mt-6"><GameSnapshotImport athletes={data.map(a=>({code:a.athlete_code,name:`${a.first_name} ${a.last_name}`}))} action={importGameSnapshot}/></div></>;
}
