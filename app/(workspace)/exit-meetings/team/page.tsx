import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { TeamReviewSheet } from "@/components/team-review-sheet";
import { requireRenderImportAccess as requireImportAccess } from "@/lib/render-access";
import { loadHomeSnapshot } from "@/lib/home-server";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { loadTeamRecords } from "@/lib/team-records-server";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { teamReportCard } from "@/lib/team-report-card";
import { teamReviewTrends } from "@/lib/team-review";
import { bwsRaces, playersOfTheWeek } from "@/lib/home-spotlight";
import { topPerformers } from "@/lib/top-performers";
import { pacificTestingDate } from "@/lib/testing-checklist";

export const metadata = { title: "Team Review Sheet" };
/**
 * November 2 owner request: a whole-team exit meeting sheet printed with the player handouts. Staff only (same
 * access as Exit Meetings); reuses the existing staff team summary, weekly, Top Performer and records readers.
 * Nothing is saved or uploaded.
 */
export default async function TeamReviewPage() {
  const access = await requireImportAccess();
  const [summary, weekly, performers, records, headshots] = await Promise.all([
    loadHomeSnapshot(access).catch(() => null),
    loadGameWeeks(access).catch(() => null),
    loadTopPerformersData().catch(() => null),
    loadTeamRecords(access).catch(() => ({ records: [], failed: 1 })),
    loadTeamHeadshots(access).catch(() => new Map<string, string>()),
  ]);
  const batting = summary?.batting ?? null, pitching = summary?.pitching ?? null;
  const labels = Object.fromEntries([...(batting?.rates ?? []), ...(pitching?.rates ?? [])].map(r => [r.metric, r.label]));
  const top = (discipline: "hitting" | "pitching") => performers ? topPerformers(performers, discipline).filter(row => row.rank !== null).sort((a, b) => a.rank! - b.rank!).slice(0, 5) : [];
  const unavailable = [!summary && "team totals", !weekly && "weekly lines and awards", !performers && "top performers", records.failed > 0 && "some testing records"].filter(Boolean);
  return <>
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><Link prefetch={false} href="/exit-meetings" className="text-link inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} aria-hidden="true"/>Exit Meetings</Link>
        <h1 className="mt-2 text-2xl font-bold">Team Review Sheet</h1>
        <p className="muted m-0 text-sm">A front-and-back Fall 2026 team sheet to print with the player handouts. Choose “Save as PDF” to download.</p></div>
      <PrintButton label="Print / Save as PDF"/>
    </div>
    {unavailable.length > 0 && <p role="status" className="notice no-print mb-4 text-sm">Unavailable right now: {unavailable.join(", ")}. Refresh before printing.</p>}
    <TeamReviewSheet data={{
      generated: pacificTestingDate(), batting, pitching,
      reportCard: teamReportCard(batting, pitching),
      trends: teamReviewTrends(weekly?.weeks ?? null, { batting, pitching }, labels),
      races: weekly ? bwsRaces(weekly.players, weekly.weeks.bws, weekly.champions) : null,
      weeks: weekly ? playersOfTheWeek(weekly.players, weekly.weeks) : [],
      hitters: top("hitting"), pitchers: top("pitching"),
      records: records.records, headshots: Object.fromEntries(headshots),
    }}/>
  </>;
}
