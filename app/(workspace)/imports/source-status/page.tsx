import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadWeeklySourceStatus } from "@/lib/weekly-source-checks";
import { WEEKLY_SOURCES } from "@/lib/weekly-source-contract";
import { recordWeeklySourceCheck } from "./actions";

const date=(value:string)=>new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles"});
const outcomeLabel={completed:"Checked",needs_review:"Needs review",failed:"Check failed"};
export default async function SourceStatusPage({searchParams}:{searchParams:Promise<{recorded?:string;error?:string}>}) {
  const access=await requireRenderImportAccess();
  const [statuses,params]=await Promise.all([loadWeeklySourceStatus(access),searchParams]);
  return <>
    <PageHeading section="Coaching" title="Weekly Source Checks" description="Record the result only after checking the approved Fall tabs or Player Metrics workbook."><Link href="/imports" className="btn btn-secondary">Import Center</Link></PageHeading>
    {params.recorded==="1"&&<p role="status" className="notice mb-4">The source check was recorded. Saved dashboard results have not changed.</p>}
    {params.error&&<p role="alert" className="notice notice-error mb-4">{params.error==="input"?"Choose an approved source and check result.":"The check could not be confirmed. Refresh and inspect the latest status before retrying."}</p>}
    <div className="grid gap-4">{WEEKLY_SOURCES.map(source=>{
      const current=statuses.find(check=>check.source===source.key);
      return <section key={source.key} className="panel p-5" aria-label={`${source.label} check status`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-lg font-bold">{source.label}</h2><p className="muted mb-0 mt-1 text-sm">{current?.checkedAt?<><strong>{outcomeLabel[current.outcome!]}</strong> · Last checked <time dateTime={current.checkedAt}>{date(current.checkedAt)}</time></>:"No completed check has been recorded in the dashboard yet."}</p><p className="muted mb-0 mt-1 text-sm">{current?.savedAt?<>Last saved <time dateTime={current.savedAt}>{date(current.savedAt)}</time></>:"No saved dashboard results yet."}</p></div><form action={recordWeeklySourceCheck} className="flex flex-wrap items-end gap-2"><input type="hidden" name="source" value={source.key}/><label className="grid gap-1 text-xs font-semibold">Check result<select name="outcome" defaultValue="completed" className="min-h-10"><option value="completed">Checked</option><option value="needs_review">Needs review</option><option value="failed">Check failed</option></select></label><button className="btn btn-secondary" type="submit">Record Check</button></form></div></section>;
    })}</div>
    <p className="muted mt-5 max-w-3xl text-sm">A check means the source was inspected. It does not confirm that new results were saved. Save dates come from the dashboard’s verified game snapshots and measurements. Automatic weekly checks run from the team’s data computer while a staff member is signed in. If one is missed, any staff member can check the source and record the result here.</p>
  </>;
}
