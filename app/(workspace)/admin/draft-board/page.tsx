import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { DraftBoard } from "@/components/draft-board";
import { loadDraftBoard } from "@/lib/draft-board-server";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";

export default async function DraftBoardPage() {
  const access = await requireAdminWorkspaceAccess();
  const [board, athletes] = await Promise.all([loadDraftBoard(access), loadStaffAthleteChoices(access)]);
  return <><PageHeading section="Administration" title="Boxer World Series" description="Your private draft room. Build the teams, follow the picks, and keep the whole board in view."/><DraftBoard initial={board} athletes={athletes.map(a => ({ id: a.id, name: a.name }))}/></>;
}
