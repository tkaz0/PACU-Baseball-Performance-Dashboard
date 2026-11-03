import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { TeamReviewSheet } from "@/components/team-review-sheet";
import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadTeamReviewData } from "@/lib/team-review-server";

export const metadata = { title: "Team Review Sheet" };
/**
 * November 2 owner request: a whole-team exit meeting sheet printed with the player handouts (also first in Print All).
 * Staff only (same access as Exit Meetings); existing staff readers; nothing is saved or uploaded.
 */
export default async function TeamReviewPage() {
  const access = await requireImportAccess();
  const { data, unavailable } = await loadTeamReviewData(access);
  return <>
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><Link prefetch={false} href="/exit-meetings" className="text-link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} aria-hidden="true"/>Exit Meetings</Link>
        <h1 className="mt-2 text-2xl font-bold">Team Review Sheet</h1>
        <p className="muted m-0 text-sm">A front-and-back Fall 2026 team sheet. Print All Players includes it first. Choose “Save as PDF” to download.</p></div>
      <PrintButton label="Print / Save as PDF"/>
    </div>
    {unavailable.length > 0 && <p role="status" className="notice no-print mb-4 text-sm">Unavailable right now: {unavailable.join(", ")}. Refresh before printing.</p>}
    <TeamReviewSheet data={data}/>
  </>;
}
