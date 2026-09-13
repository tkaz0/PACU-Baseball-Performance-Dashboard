import { PageHeading } from "@/components/page-heading";
import { TeamProgress } from "@/components/team-progress";
import { loadCoachingData } from "@/lib/analytics-server";
import { pacificTestingDate } from "@/lib/testing-checklist";
export default async function TeamProgressPage(){
 const data=await loadCoachingData();
 return <><PageHeading section="Staff Tools" title="Team Progress" description="See what changed, and who is ready for another test."/><TeamProgress data={data} today={pacificTestingDate()}/></>;
}
