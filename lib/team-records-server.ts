import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadLeaderboardComparisons, loadLeaderboards } from "@/lib/leaderboard-server";
import { teamRecord, teamRecordSelections, type TeamRecord } from "@/lib/team-records";

/** Same signed-in leaderboard projection as /leaderboards; a failed board is counted, never substituted. */
export async function loadTeamRecords(access: Awaited<ReturnType<typeof requireAccess>>): Promise<{ records: TeamRecord[]; failed: number }> {
  const selections = teamRecordSelections(await loadLeaderboardComparisons(access));
  const results = await loadLeaderboards(access, selections.map(item => item.comparison));
  let failed = 0;
  const records = selections.flatMap((item, index) => {
    const result = results[index];
    if (result instanceof Error) { failed++; return []; }
    const record = teamRecord(item.comparison, item.category, result);
    return record ? [record] : [];
  });
  return { records, failed };
}
