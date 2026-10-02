import { PageHeading } from "@/components/page-heading";
import { TopPerformers } from "@/components/top-performers";
import { PrintButton } from "@/components/print-button";
import { requireRenderAccess } from "@/lib/render-access";
import { loadTopPerformersData } from "@/lib/analytics-server";
import { loadTeamHeadshots } from "@/lib/headshots-server";
export const metadata = { title: "Top Performers" };
export default async function TopPerformersPage() {
  const access = await requireRenderAccess(["admin", "coach"]);
  const [data, headshots] = await Promise.all([loadTopPerformersData(), loadTeamHeadshots(access)]);
  return <><PageHeading section="Coaching" title="Top Performers" description="Cumulative Fall game stats. Choose a stat to rank hitters or pitchers, with sample sizes beside every result."><PrintButton label="Print Top Performers"/></PageHeading><TopPerformers data={data} headshots={Object.fromEntries(headshots)}/></>;
}
