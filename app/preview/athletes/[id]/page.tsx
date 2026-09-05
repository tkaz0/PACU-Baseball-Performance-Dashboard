import { LocalAthleteProfile } from "@/components/local-dashboard";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
export default async function PreviewProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminWorkspaceAccess();
  const { id } = await params;
  return <LocalAthleteProfile id={id} />;
}
