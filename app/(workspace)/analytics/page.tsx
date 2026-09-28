import { AnalyticsExplorer } from "@/components/analytics-explorer";
import { loadAnalytics } from "@/lib/analytics-server";
import { PageHeading } from "@/components/page-heading";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadSavedAnalyticsViews } from "@/lib/personal-dashboard-server";
import { AnalyticsNavigation } from "@/components/analytics-navigation";
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const access=await requireRenderImportAccess();
  const [data,savedViews]=await Promise.all([loadAnalytics(),loadSavedAnalyticsViews(access)]);
  const query=await searchParams;
  const initialX=typeof query.x==="string"&&query.x.length<=600?query.x:"",initialY=typeof query.y==="string"&&query.y.length<=600?query.y:"";
  const initialPeriod=query.period==="earlier"?"earlier":"fall",initialWindow=typeof query.window==="string"?Number(query.window):30;
  return <><PageHeading section="Pacific Baseball / Coaching Tools" title="Analytics" description="See how two team stats move together."/><AnalyticsNavigation current="scatter"/><AnalyticsExplorer key={JSON.stringify([initialX,initialY,initialPeriod,initialWindow])} data={data} savedViews={savedViews} initialX={initialX} initialY={initialY} initialPeriod={initialPeriod} initialWindow={initialWindow}/></>;
}
