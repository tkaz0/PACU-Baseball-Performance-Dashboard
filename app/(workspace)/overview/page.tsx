import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { workspaceHome, workspacePreviewQuery } from "@/lib/workspace-home";

/** Keep existing bookmarks and authentication redirects working after retiring Team Overview. */
export default async function Overview({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const destination = workspaceHome(access);
  if (destination !== "/overview") redirect(`${destination}${workspacePreviewQuery(params.preview)}`);
  return <>
    <AccessPreviewNotice status={params.preview} isPreview={!!access.preview} />
    <PageHeading section="Your workspace" title="Your profile is being connected" description="Your administrator will link your account to the correct player profile." />
  </>;
}
