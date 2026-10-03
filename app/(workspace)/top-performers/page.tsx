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
  return <><PageHeading section="Coaching" title="Top Performers" description="One overall ranking from cumulative Fall game stats. Equal-weight scores, with the numbers and sample sizes behind each rank."><PrintButton label="Print Top Performers"/></PageHeading><TopPerformers data={data} headshots={Object.fromEntries(headshots)}/></>;
}
