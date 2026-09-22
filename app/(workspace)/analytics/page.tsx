import { AnalyticsExplorer } from "@/components/analytics-explorer";
import { loadAnalytics } from "@/lib/analytics-server";
import { PageHeading } from "@/components/page-heading";
export default async function AnalyticsPage(){
  const data=await loadAnalytics();
  return <><PageHeading section="Pacific Baseball / Coaching Tools" title="Analytics" description="See how two team stats move together."/><AnalyticsExplorer data={data}/></>;
}
