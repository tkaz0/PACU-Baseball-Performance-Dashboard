import { ImportCenter } from "@/components/import-center";
import { PageHeading } from "@/components/page-heading";
import { requireAdminWorkspaceAccess } from "@/lib/auth";

export default async function ImportPage() {
  await requireAdminWorkspaceAccess();
  return (
    <>
      <PageHeading section="Your browser workspace" title="Import Center" description="Choose a roster spreadsheet, a RENPHO image or PDF, or another measurement file. Review once, then save to your player profiles." />
      <ImportCenter />
    </>
  );
}
