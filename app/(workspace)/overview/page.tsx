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
import { HomeSpotlight } from "@/components/home-spotlight";
import { playersOfTheWeek } from "@/lib/home-spotlight";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import { loadDesignNavigation } from "@/lib/design-navigation-server";

/** One failed Home section must not take down the whole page; the failure is logged by section name. */
function settle<T>(section:string,failed:string[],promise:Promise<T>,fallback:T):Promise<T>{
  return promise.catch((error:unknown)=>{failed.push(section);console.error(`Home ${section} failed:`,error instanceof Error?error.message:"unknown error");return fallback;});
}

export default async function Overview({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const access=await requireAccess();
  const staff=canImportPresentedAccess(access);
  const failed:string[]=[], viewedAt=new Date().toISOString();
  const visitPromise=settle("visit tracking",failed,loadDashboardVisit(access,viewedAt),{since:null,viewedAt,record:false});
  const activityPromise=visitPromise.then(visit=>loadHomeActivity(access,visit)).catch(()=>({ok:false as const}));
  const leaderboardsPromise=settle("leaderboards",failed,loadHomeLeaderboards(access),[]);
  const trendsPromise=staff?loadTeamGameTrends(access).catch(()=>({})):Promise.resolve({});
  const canSeeBoards=staff || (access.roles.includes("player") && !!access.athleteId);
  const weeksPromise=canSeeBoards?settle("players of the week",failed,loadGameWeeks(access),null):Promise.resolve(null);
  const photosPromise=canSeeBoards?settle("headshots",failed,loadTeamHeadshots(access),new Map<string,string>()):Promise.resolve(new Map<string,string>());
  const [params,summary,leaderboards,sourceStatus,designNavigation,visit,headshots,weekly]=await Promise.all([
    searchParams,settle("results summary",failed,loadHomeSnapshot(access),null),leaderboardsPromise,
    staff?settle("source status",failed,loadWeeklySourceStatus(access),[]):Promise.resolve([]),settle("design links",failed,loadDesignNavigation(access),undefined),visitPromise,photosPromise,weeksPromise,
  ]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/>{failed.length>0&&<p role="status" className="muted mb-4 text-sm">Some Home sections are temporarily unavailable ({failed.join(", ")}). Refresh to try again.</p>}<DashboardHome
    coachingPulse={staff&&summary?<Suspense fallback={<HomeActivityPlaceholder coaching/>}><HomeCoachingPulse activity={activityPromise} reviewCount={[...summary.batting.rates,...summary.pitching.rates].filter(rate=>rate.pending&&rate.pendingReason!=="missing").length}/></Suspense>:undefined}
    activity={summary?<Suspense fallback={<HomeActivityPlaceholder/>}><HomeVisitActivity activity={activityPromise} visit={visit} staff={staff} athleteId={access.athleteId}/></Suspense>:undefined}
    streamedTrend={staff?(source,metric,label)=><Suspense fallback={null}><HomeGameTrend trends={trendsPromise} source={source} metric={metric} label={label}/></Suspense>:undefined}
    spotlight={weekly?<HomeSpotlight weeks={playersOfTheWeek(weekly.players,weekly.weeks)} headshots={Object.fromEntries(headshots)} showRankingLink={staff}/>:undefined}
    headshots={Object.fromEntries(headshots)} staff={staff} athleteId={access.athleteId} summary={summary} leaderboards={leaderboards} sourceStatus={sourceStatus} visit={visit} designNavigation={designNavigation}/></>;
}
