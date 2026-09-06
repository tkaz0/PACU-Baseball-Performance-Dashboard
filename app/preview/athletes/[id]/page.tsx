import { LocalAthleteProfile } from "@/components/local-dashboard";
import { requireImportAccess } from "@/lib/auth";
export default async function PreviewProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireImportAccess();
  const { id } = await params;
  return <LocalAthleteProfile id={id} />;
}
