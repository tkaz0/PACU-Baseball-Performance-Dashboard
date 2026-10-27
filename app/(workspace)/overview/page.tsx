import { Suspense } from "react";
import { TeamGameTrend } from "@/components/team-game-trend";
import { PlayerWeek } from "@/components/player-week";
import { SkeletonCards, SkeletonPanel } from "@/components/skeleton";
import { loadOwnGameTrends, loadTeamGameTrends } from "@/lib/game-trends-server";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import { DashboardHome, HomeLeaderboardCards, HomeLeaderboardPlaceholder } from "@/components/dashboard-home";
import { loadTeamHeadshots } from "@/lib/headshots-server";
import { loadHomeSnapshot, loadHomeActivity } from "@/lib/home-server";
import { loadHomeLeaderboards } from "@/lib/home-leaderboards-server";
import { loadDashboardVisit } from "@/lib/personal-dashboard-server";
import { HomeSpotlight } from "@/components/home-spotlight";
import { HomeTrending } from "@/components/home-trending";
import { trendingPlayers } from "@/lib/home-trending";
import { playersOfTheWeek, bwsRaces } from "@/lib/home-spotlight";
import { loadGameWeeks } from "@/lib/game-weeks-server";
import { loadDesignNavigation } from "@/lib/design-navigation-server";
import { loadFallBallWeeks } from "@/lib/fall-ball-weeks-server";

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
  // Streamed sections: Players of the Week and team leaders never hold up the rest of Home.
  const leaderboardsPromise=loadHomeLeaderboards(access).catch(()=>null);
  // Staff see team week-over-week changes; a linked player sees only their own.
  const ownTrends=!staff&&access.roles.includes("player")&&!!access.athleteId;
  const trendsPromise=staff?loadTeamGameTrends(access).catch(()=>({})):ownTrends?loadOwnGameTrends(access).catch(()=>({})):Promise.resolve({});
  const canSeeBoards=staff || (access.roles.includes("player") && !!access.athleteId);
  const weeksPromise=canSeeBoards?loadGameWeeks(access).catch(()=>null):Promise.resolve(null);
  const photosPromise=canSeeBoards?loadTeamHeadshots(access).catch(()=>new Map<string,string>()):Promise.resolve(new Map<string,string>());
  // Home is viewer-facing: update dates, source checks, testing follow-ups and coverage live under Data & Testing.
  const [params,summary,designNavigation]=await Promise.all([
    searchParams.then(async value=>{await loadFallBallWeeks(access);return value;}),settle("results summary",failed,loadHomeSnapshot(access),null),
    settle("design links",failed,loadDesignNavigation(access),undefined),
  ]);
  return <><AccessPreviewNotice status={params.preview} isPreview={!!access.preview}/>{failed.length>0&&<p role="status" className="muted mb-4 text-sm">Some Home sections are temporarily unavailable ({failed.join(", ")}). Refresh to try again.</p>}<DashboardHome
    streamedTrend={staff||ownTrends?(source,metric,updatedAt)=><Suspense fallback={null}><TeamGameTrend trends={trendsPromise} source={source} metric={metric} updatedAt={updatedAt}/></Suspense>:undefined}
    spotlight={canSeeBoards?<Suspense fallback={<SkeletonCards count={2} tall label="Loading Players of the Week"/>}><StreamedSpotlight weeks={weeksPromise} photos={photosPromise} staff={staff}/></Suspense>:undefined}
    trending={staff?<Suspense fallback={<SkeletonPanel rows={3} label="Loading Trending Up"/>}><StreamedTrending weeks={weeksPromise}/></Suspense>:undefined}
    leaderboardsSlot={<Suspense fallback={<HomeLeaderboardPlaceholder/>}><StreamedLeaderboards boards={leaderboardsPromise} photos={photosPromise}/></Suspense>}
    playerWeek={ownTrends&&summary?<Suspense fallback={null}><PlayerWeek trends={trendsPromise} activity={activityPromise} batting={summary.batting} pitching={summary.pitching}/></Suspense>:undefined}
    staff={staff} athleteId={access.athleteId} summary={summary} designNavigation={designNavigation}/></>;
}

async function StreamedTrending({weeks}:{weeks:ReturnType<typeof loadGameWeeks>|Promise<null>}){
  const weekly=await weeks;
  return <HomeTrending groups={weekly?trendingPlayers(weekly.players,weekly.weeks):null}/>;
}

async function StreamedSpotlight({weeks,photos,staff}:{weeks:ReturnType<typeof loadGameWeeks>|Promise<null>;photos:Promise<Map<string,string>>;staff:boolean}){
  const [weekly,headshots]=await Promise.all([weeks,photos]);
  return weekly?<HomeSpotlight weeks={playersOfTheWeek(weekly.players,weekly.weeks)} races={bwsRaces(weekly.players,weekly.weeks.bws)} headshots={Object.fromEntries(headshots)} showRankingLink={staff}/>:null;
}
async function StreamedLeaderboards({boards,photos}:{boards:Promise<Awaited<ReturnType<typeof loadHomeLeaderboards>>|null>;photos:Promise<Map<string,string>>}){
  const [leaderboards,headshots]=await Promise.all([boards,photos]);
  return <HomeLeaderboardCards leaderboards={leaderboards} headshots={Object.fromEntries(headshots)}/>;
}
