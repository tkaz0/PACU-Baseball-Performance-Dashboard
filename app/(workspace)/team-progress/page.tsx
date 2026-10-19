import { PageHeading } from "@/components/page-heading";
import { TeamProgress } from "@/components/team-progress";
import { loadCoachingData } from "@/lib/analytics-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { requireRenderImportAccess } from "@/lib/render-access";
import { loadTeamHeadshots } from "@/lib/headshots-server";
export default async function TeamProgressPage(){
 const access=await requireRenderImportAccess();
 const [data,headshots]=await Promise.all([loadCoachingData(),loadTeamHeadshots(access).catch(()=>new Map<string,string>())]);
 return <><PageHeading section="Coaching" title="Team Progress" description="See what changed, and who is ready for another test."/><TeamProgress data={data} today={pacificTestingDate()} headshots={Object.fromEntries(headshots)}/></>;
}
