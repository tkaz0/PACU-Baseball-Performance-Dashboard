import { AnalyticsExplorer } from "@/components/analytics-explorer";
import { loadAnalytics } from "@/lib/analytics-server";
import { PageHeading } from "@/components/page-heading";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadSavedAnalyticsViews } from "@/lib/personal-dashboard-server";
import { AnalyticsNavigation } from "@/components/analytics-navigation";
import { after } from "next/server";
import { KeyConnections } from "@/components/key-connections";
import { connectionHistory, keyConnections, pacificWeekStart } from "@/lib/key-connections";
import { loadConnectionSnapshots, saveConnectionSnapshots } from "@/lib/key-connections-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const access=await requireRenderImportAccess();
  const [data,savedViews,snapshots]=await Promise.all([loadAnalytics(),loadSavedAnalyticsViews(access),loadConnectionSnapshots(access)]);
  const connections=keyConnections(data),weekStart=pacificWeekStart(pacificTestingDate());
  // One aggregate r/n row per pair per week; saving never blocks or fails the page.
  after(()=>saveConnectionSnapshots(access,weekStart,connections,snapshots).catch(()=>undefined));
  const query=await searchParams;
  const initialX=typeof query.x==="string"&&query.x.length<=600?query.x:"",initialY=typeof query.y==="string"&&query.y.length<=600?query.y:"";
  const initialPeriod=query.period==="earlier"?"earlier":"fall",initialWindow=typeof query.window==="string"?Number(query.window):30;
  return <><PageHeading section="Coaching" title="Analytics" description="See how two team stats move together."/><AnalyticsNavigation current="scatter"/><KeyConnections results={connections} history={connectionHistory(snapshots??[],connections,weekStart)} historyAvailable={snapshots!==null}/><AnalyticsExplorer key={JSON.stringify([initialX,initialY,initialPeriod,initialWindow])} data={data} savedViews={savedViews} tracked={connections.flatMap(c=>c.xKey&&c.yKey?[{xKey:c.xKey,yKey:c.yKey,title:c.pair.title,r:c.r,n:c.n}]:[])} initialX={initialX} initialY={initialY} initialPeriod={initialPeriod} initialWindow={initialWindow}/></>;
}
