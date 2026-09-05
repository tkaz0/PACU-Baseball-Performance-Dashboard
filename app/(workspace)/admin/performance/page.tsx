import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { athleteName } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";
import { SharedPerformanceImport } from "@/components/shared-performance-import";
import { shareMeasurements } from "./actions";
const messages: Record<string,string> = { review: "Review the measurements and check the approval box before sharing.", input: "These measurements could not be validated. Choose the backup again and review its values and source details.", save: "The import could not be confirmed. Refresh the profiles and import history before trying again; no conflicting observation is overwritten." };
export default async function PerformanceImport({ searchParams }: { searchParams: Promise<{error?:string;import?:string}> }) {
  const { supabase } = await requireAccess(["admin"]);
  const params = await searchParams;
  const [roster,imports] = await Promise.all([
    supabase.from("athletes").select("athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season)").eq("athlete_seasons.season","2026-27").order("last_name").limit(1000),
    supabase.from("performance_imports").select("id,created_at,created_count,unchanged_count").order("created_at",{ascending:false}).limit(10),
  ]);
  if (roster.error || imports.error) throw new Error("Unable to load shared measurement imports.");
  const saved = (imports.data ?? []).find(item => item.id === params.import);
  return <>
    <PageHeading section="Administration" title="Shared measurements" description="Publish reviewed readings to the private player profiles."><Link href="/preview/import" className="btn btn-secondary">Browser Import Center</Link></PageHeading>
    {params.error && <p role="alert" className="notice notice-error mb-6">{Object.hasOwn(messages, params.error) ? messages[params.error] : "Unable to share measurements."}</p>}
    {saved && <p role="status" className="notice notice-success mb-6">Shared measurements saved: {saved.created_count} new · {saved.unchanged_count} already present.</p>}
    <SharedPerformanceImport athletes={(roster.data ?? []).map(athlete => ({ code:athlete.athlete_code, name:athleteName(athlete) }))} action={shareMeasurements} />
    <h2 className="mb-4 mt-8 text-lg font-bold">Recent shared imports</h2>
    <div className="panel table-wrap"><table><thead><tr><th>Saved (UTC)</th><th>New readings</th><th>Already present</th></tr></thead><tbody>{(imports.data ?? []).map(item => <tr key={item.id}><td>{new Date(item.created_at).toISOString().slice(0,16).replace("T"," ")}</td><td>{item.created_count}</td><td>{item.unchanged_count}</td></tr>)}</tbody></table>{!imports.data?.length && <p className="p-5 text-sm text-gray-500">No measurements have been shared yet.</p>}</div>
  </>;
}
