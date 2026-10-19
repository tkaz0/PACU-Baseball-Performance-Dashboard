import { PageHeading } from "@/components/page-heading";
import { ComparisonWorkspace } from "@/components/comparison-workspace";
import { loadComparisonData } from "@/lib/analytics-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadTeamHeadshots } from "@/lib/headshots-server";
export default async function ComparePage(){
 const access=await requireRenderImportAccess();
 const [data,headshots]=await Promise.all([loadComparisonData(),loadTeamHeadshots(access).catch(()=>new Map<string,string>())]);
 return <><PageHeading section="Coaching" title="Compare Players" description="Compare a few players or a whole position group to plan your lineup."/><ComparisonWorkspace data={data} today={pacificTestingDate()} headshots={Object.fromEntries(headshots)}/></>;
}
