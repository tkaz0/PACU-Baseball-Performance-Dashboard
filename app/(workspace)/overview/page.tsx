import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadHomeSummary } from "@/lib/home-server";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const [params,summary]=await Promise.all([searchParams,loadHomeSummary(access)]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome staff={canImportPresentedAccess(access)} athleteId={access.athleteId} summary={summary}/></>;
}
