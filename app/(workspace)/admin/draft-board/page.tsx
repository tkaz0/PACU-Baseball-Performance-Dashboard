import { redirect } from "next/navigation";
import { requireAdminWorkspaceAccess } from "@/lib/auth";

/** The draft is finished; the retired draft room now opens the private BWS Team workspace. Saved draft data is retained. */
export default async function DraftBoardPage() {
  await requireAdminWorkspaceAccess();
  redirect("/admin/bws-team");
}
