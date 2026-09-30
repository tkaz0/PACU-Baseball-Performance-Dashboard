import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadHomeSummary } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import { loadDueCoachFocus } from "@/lib/coach-focus-server";
import { loadDashboardVisit } from "@/lib/personal-dashboard-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { loadWeeklySourceStatus } from "@/lib/weekly-source-checks";
import { loadDesignNavigation } from "@/lib/design-navigation-server";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const staff=canImportPresentedAccess(access);
  const visit=await loadDashboardVisit(access,new Date().toISOString());
  const [params,summary,leaderboards,dueFocus,sourceStatus,designNavigation]=await Promise.all([searchParams,loadHomeSummary(access,visit),loadHomeLeaderboards(access),staff?loadDueCoachFocus(access,pacificTestingDate()):Promise.resolve([]),staff?loadWeeklySourceStatus(access):Promise.resolve([]),loadDesignNavigation(access)]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome staff={staff} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards} dueFocus={dueFocus} sourceStatus={sourceStatus} visit={visit} designNavigation={designNavigation}/></>;
}
