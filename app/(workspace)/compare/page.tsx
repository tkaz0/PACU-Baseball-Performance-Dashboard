import { PageHeading } from "@/components/page-heading";
import { ComparisonWorkspace } from "@/components/comparison-workspace";
import { loadComparisonData } from "@/lib/analytics-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
export default async function ComparePage(){
 const data=await loadComparisonData();
 return <><PageHeading section="Coaching" title="Compare Players" description="Compare a few players or a whole position group to plan your lineup."/><ComparisonWorkspace data={data} today={pacificTestingDate()}/></>;
}
