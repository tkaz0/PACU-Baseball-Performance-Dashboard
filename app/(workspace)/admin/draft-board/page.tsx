import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { DraftBoard } from "@/components/draft-board";
import { loadDraftBoard } from "@/lib/draft-board-server";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { draftPerformance } from "@/lib/draft-performance";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";

export default async function DraftBoardPage() {
  const access = await requireAdminWorkspaceAccess();
  const [board, athletes, performance] = await Promise.all([loadDraftBoard(access), loadStaffAthleteChoices(access), loadTopPerformersData().then(draftPerformance).catch(() => null)]);
  return <><PageHeading section="Administration" title="Boxer World Series" description="Your private draft room. Build the teams, follow the picks, and keep the whole board in view."/><DraftBoard initial={board} performance={performance} athletes={athletes.map(a => ({ id: a.id, name: a.name }))}/></>;
}
