import { PageHeading } from "@/components/page-heading";
import { DepthChart } from "@/components/depth-chart";
import { PrintButton } from "@/components/print-button";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { loadComparisonData } from "@/lib/analytics-server";
import { buildDepthChart } from "@/lib/depth-chart";
import { loadTeamHeadshots } from "@/lib/headshots-server";

export const metadata = { title: "Depth Chart" };

export default async function DepthChartPage() {
  const access = await requireAccess(["admin", "coach"]);
  const [data, headshots] = await Promise.all([loadComparisonData(), loadTeamHeadshots(access)]);
  return <><PageHeading section="Coaching" title="Depth Chart" description="Every player at their primary and secondary positions, ranked together by PAC Production+ (hitters) or WHIP (pitchers). Small samples are labeled."><PrintButton label="Print Depth Chart"/></PageHeading>
    <DepthChart chart={buildDepthChart(data)} headshots={Object.fromEntries(headshots)}/></>;
}
