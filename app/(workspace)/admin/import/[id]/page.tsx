import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { display, UUID_PATTERN, type ImportDraft } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";
import { SubmitButton } from "@/components/submit-button";
import { approveImport } from "../actions";
export default async function ImportReview({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{error?:string}> }) {
  const { supabase, user } = await requireAccess(["admin"]);
  const { id } = await params;
  const query = await searchParams;
  if (!UUID_PATTERN.test(id)) notFound();
  const { data, error } = await supabase.from("roster_imports").select("id,created_by,season,filename,source_sha256,preview,status,created_at,applied_at").eq("id",id).maybeSingle();
  if (error) throw new Error("Unable to load import preview.");
  if (!data) notFound();
  const draft = data as ImportDraft;
  const applied = draft.status === "applied";
  const canApprove = !applied && draft.preview.reject === 0 && draft.created_by === user.id;
  return <><PageHeading section="Administration / Roster import" title={applied ? "Import Complete" : "Review Roster Changes"} description={`${draft.filename} · Season ${draft.season} · ${draft.preview.rows.length} rows`}><Link href="/admin/import" className="btn btn-secondary">New upload</Link></PageHeading>
    {query.error && <p role="alert" className="notice notice-error mb-6">{query.error === "confirm" ? "Confirm that you have reviewed the changes." : "Approval was not applied. The preview may be stale, expired, contain rejected rows, or belong to another administrator. Upload again to review current changes."}</p>}
    {applied && <p role="status" className="notice notice-success mb-6">The approved roster changes and audit record were saved together.</p>}
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{([['create','Create'],['update','Update'],['unchanged','Unchanged'],['reject','Reject']] as const).map(([key,label]) => <div key={key} className="panel p-5"><p className="mb-2 text-sm text-gray-500">{label}</p><p className={`mb-0 text-3xl font-bold ${key === "reject" && draft.preview.reject ? "text-pacu-red" : ""}`}>{draft.preview[key]}</p></div>)}</div>
    <div className="panel table-wrap"><table><thead><tr><th>CSV row</th><th>Athlete code</th><th>Action</th><th>Changes or validation issues</th></tr></thead><tbody>{draft.preview.rows.map(row => <tr key={row.row}><td>{row.row}</td><td className="font-mono text-xs">{row.athlete_code}</td><td><span className={`badge ${row.action === "reject" ? "badge-red" : row.action === "create" ? "badge-green" : ""}`}>{row.action}</span></td><td className="min-w-[320px]">{row.errors.length ? <ul className="list-disc pl-4 text-pacu-red">{row.errors.map((err,i) => <li key={i}>{err}</li>)}</ul> : row.changes.length ? <details><summary className="cursor-pointer font-semibold">{row.changes.length} field changes</summary><dl className="mt-3 space-y-2">{row.changes.map(change => <div key={change.field}><dt className="text-xs text-gray-500">{change.field}</dt><dd className="m-0 break-all">{display(change.before)} <span className="mx-1 text-gray-400">→</span> {display(change.after)}</dd></div>)}</dl></details> : "No field changes"}</td></tr>)}</tbody></table></div>
    {!applied && <section className="panel mt-6 p-6">{draft.preview.reject > 0 ? <p className="mb-0 text-sm text-pacu-red">Correct all rejected rows in the source file, then upload it again. No rows from this draft have been applied.</p> : draft.created_by !== user.id ? <p className="mb-0 text-sm text-gray-500">Only the administrator who uploaded this draft can approve it.</p> : <form action={approveImport}><input type="hidden" name="import_id" value={id} /><label className="mb-5 flex items-start gap-3"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5!" /><span>I have reviewed these changes for season {draft.season} and approve this batch.</span></label><SubmitButton disabled={!canApprove} pendingText="Applying approved changes…">Approve and apply import</SubmitButton><p className="muted mb-0 mt-4 text-xs">Preview expires after 24 hours. If roster data changes, a new preview is required.</p></form>}</section>}
    <p className="mt-5 break-all font-mono text-xs text-gray-400">Source SHA-256: {draft.source_sha256}</p>
  </>;
}
