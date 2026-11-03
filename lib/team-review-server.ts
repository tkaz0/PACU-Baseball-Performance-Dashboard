import "server-only";
import type { requireAccess } from "@/lib/auth";
import type { TeamReviewData } from "@/components/team-review-sheet";
import { loadHomeSnapshot } from "@/lib/home-server";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { loadTeamRecords } from "@/lib/team-records-server";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadGameLeaderboards } from "@/lib/game-comparison-server";
import { teamReportCard } from "@/lib/team-report-card";
import { teamReviewTrends, teamStatLeaders } from "@/lib/team-review";
import { bwsRaces } from "@/lib/home-spotlight";
import { topPerformers } from "@/lib/top-performers";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { fallBallWeeksPlayed, qualifiedGameCodes } from "@/lib/game-qualification";

/**
 * The whole-team exit meeting sheet (staff only; callers check access). Existing staff readers only; a failed
 * reader is named in `unavailable` rather than substituted.
 */
export async function loadTeamReviewData(access: Awaited<ReturnType<typeof requireAccess>>): Promise<{ data: TeamReviewData; unavailable: string[] }> {
  const [summary, weekly, performers, records, headshots, boards] = await Promise.all([
    loadHomeSnapshot(access).catch(() => null),
    loadGameWeeks(access).catch(() => null),
    loadTopPerformersData().catch(() => null),
    loadTeamRecords(access).catch(() => ({ records: [], failed: 1 })),
    loadTeamHeadshots(access).catch(() => new Map<string, string>()),
    loadGameLeaderboards(access).catch(() => null),
  ]);
  const batting = summary?.batting ?? null, pitching = summary?.pitching ?? null;
  const labels = Object.fromEntries([...(batting?.rates ?? []), ...(pitching?.rates ?? [])].map(r => [r.metric, r.label]));
  const top = (discipline: "hitting" | "pitching") => performers ? topPerformers(performers, discipline).filter(row => row.rank !== null).sort((a, b) => a.rank! - b.rank!).slice(0, 5) : [];
  const weeks = fallBallWeeksPlayed(pacificTestingDate());
  const leaders = (discipline: "hitting" | "pitching") => {
    if (!boards) return [];
    const rows = boards.filter(r => r.source === (discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026"));
    return teamStatLeaders(rows, discipline, qualifiedGameCodes(rows, discipline, weeks).codes, labels);
  };
  const qualifiedLabel = boards ? `${qualifiedGameCodes(boards.filter(r => r.source === "qpa_fall_2026"), "hitting", weeks).label} / ${qualifiedGameCodes(boards.filter(r => r.source === "pitching_fall_2026"), "pitching", weeks).label}` : null;
  const unavailable = [!summary && "team totals", !weekly && "weekly lines", !performers && "top performers", !boards && "stat leaders", records.failed > 0 && "some testing records"].filter((x): x is string => !!x);
  return { unavailable, data: {
    generated: pacificTestingDate(), batting, pitching,
    reportCard: teamReportCard(batting, pitching),
    trends: teamReviewTrends(weekly?.weeks ?? null, { batting, pitching }, labels),
    races: weekly ? bwsRaces(weekly.players, weekly.weeks.bws, weekly.champions) : null,
    hitters: top("hitting"), pitchers: top("pitching"),
    hittingLeaders: leaders("hitting"), pitchingLeaders: leaders("pitching"), qualifiedLabel,
    records: records.records, headshots: Object.fromEntries(headshots),
  } };
}
