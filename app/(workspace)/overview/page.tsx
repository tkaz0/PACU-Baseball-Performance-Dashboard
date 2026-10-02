import { loadTeamGameTrends } from "@/lib/game-trends-server";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadHomeSummary } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import { loadDashboardVisit } from "@/lib/personal-dashboard-server";
import { loadWeeklySourceStatus } from "@/lib/weekly-source-checks";
import { loadDesignNavigation } from "@/lib/design-navigation-server";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const staff=canImportPresentedAccess(access);
  const visit=await loadDashboardVisit(access,new Date().toISOString());
  const [params,summary,leaderboards,sourceStatus,designNavigation]=await Promise.all([searchParams,loadHomeSummary(access,visit),loadHomeLeaderboards(access),staff?loadWeeklySourceStatus(access):Promise.resolve([]),loadDesignNavigation(access)]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome gameTrends={staff ? await loadTeamGameTrends(access) : {}} headshots={leaderboards.length ? Object.fromEntries(await loadTeamHeadshots(access)) : {}} staff={staff} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards} sourceStatus={sourceStatus} visit={visit} designNavigation={designNavigation}/></>;
}
