import { PageHeading } from "@/components/page-heading";
import { PlayerComparison } from "@/components/player-comparison";
import { loadComparisonData } from "@/lib/analytics-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
export default async function ComparePage(){
 const data=await loadComparisonData();
 return <><PageHeading section="Staff Tools" title="Compare Players" description="Two players. The same measurement, source and scale."/><PlayerComparison data={data} today={pacificTestingDate()}/></>;
}
