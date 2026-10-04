import { Suspense } from "react";
import { HomeActivityPlaceholder, HomeCoachingPulse, HomeVisitActivity } from "@/components/home-activity";
import { HomeGameTrend } from "@/components/home-game-trend";
import { loadTeamGameTrends } from "@/lib/game-trends-server";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome } from "@/components/dashboard-home";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadHomeSnapshot, loadHomeActivity } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import { loadDashboardVisit } from "@/lib/personal-dashboard-server";
import { loadWeeklySourceStatus } from "@/lib/weekly-source-checks";
import { loadDesignNavigation } from "@/lib/design-navigation-server";

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const staff=canImportPresentedAccess(access);
  const visitPromise=loadDashboardVisit(access,new Date().toISOString());
  const activityPromise=visitPromise.then(visit=>loadHomeActivity(access,visit)).catch(()=>({ok:false as const}));
  const leaderboardsPromise=loadHomeLeaderboards(access);
  const trendsPromise=staff?loadTeamGameTrends(access).catch(()=>({})):Promise.resolve({});
  const canSeeBoards=staff || (access.roles.includes("player") && !!access.athleteId);
  const photosPromise=canSeeBoards?loadTeamHeadshots(access):Promise.resolve(new Map<string,string>());
  const [params,summary,leaderboards,sourceStatus,designNavigation,visit,headshots]=await Promise.all([
    searchParams,loadHomeSnapshot(access),leaderboardsPromise,
    staff?loadWeeklySourceStatus(access):Promise.resolve([]),loadDesignNavigation(access),visitPromise,photosPromise,
  ]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/><DashboardHome
    coachingPulse={staff&&summary?<Suspense fallback={<HomeActivityPlaceholder coaching/>}><HomeCoachingPulse activity={activityPromise} reviewCount={[...summary.batting.rates,...summary.pitching.rates].filter(rate=>rate.pending&&rate.pendingReason!=="missing").length}/></Suspense>:undefined}
    activity={summary?<Suspense fallback={<HomeActivityPlaceholder/>}><HomeVisitActivity activity={activityPromise} visit={visit} staff={staff} athleteId={access.athleteId}/></Suspense>:undefined}
    streamedTrend={staff?(source,metric,label)=><Suspense fallback={null}><HomeGameTrend trends={trendsPromise} source={source} metric={metric} label={label}/></Suspense>:undefined}
    headshots={Object.fromEntries(headshots)} staff={staff} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards} sourceStatus={sourceStatus} visit={visit} designNavigation={designNavigation}/></>;
}
