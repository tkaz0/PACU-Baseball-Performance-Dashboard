import { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadHomeSummary } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const [params,summary,leaderboards]=await Promise.all([searchParams,loadHomeSummary(access),loadHomeLeaderboards(access)]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome staff={canImportPresentedAccess(access)} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards}/></>;
}
