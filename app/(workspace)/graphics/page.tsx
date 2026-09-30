import { requireRenderAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { GraphicsStudio } from "@/components/graphics-studio";
import { PageHeading } from "@/components/page-heading";

export const metadata = { title: "Graphics" };

export default async function GraphicsPage() {
 const access=await requireRenderAccess();
 const staff=access.roles.some(role=>role==="admin"||role==="coach");
 const players=staff?await loadStaffAthleteChoices(access):[];
 return <><PageHeading section="Pacific Baseball / Share Your Results" title="Graphics" description="Turn your results into Boxer Baseball graphics for posts, stories, and presentations."/>
  <GraphicsStudio key={`${staff?"staff":"player"}:${access.athleteId??"none"}:${access.preview?.role??"actual"}`} staff={staff} players={players} ownAthleteId={access.athleteId}/>
 </>;
}
