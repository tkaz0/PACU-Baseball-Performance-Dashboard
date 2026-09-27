import { AnalyticsNavigation } from "@/components/analytics-navigation";
import { CorrelationMap } from "@/components/correlation-map";
import { PageHeading } from "@/components/page-heading";
import { loadAnalytics } from "@/lib/analytics-server";
export const metadata = { title: "Correlation Map" };
export default async function CorrelationMapPage() {
  const data = await loadAnalytics();
  return <><PageHeading section="Coaching Tools" title="Correlation Map" description="See which measured stats move together across the team." /><AnalyticsNavigation current="map" /><CorrelationMap data={data} /></>;
}
