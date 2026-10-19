import { requireRenderAccess } from "@/lib/render-access";
import { loadStaffAthleteChoices } from "@/lib/staff-athlete-search-server";
import { GraphicsStudio } from "@/components/graphics-studio";
import { PageHeading } from "@/components/page-heading";

export const metadata = { title: "Graphics" };

export default async function GraphicsPage({ searchParams }: { searchParams: Promise<{ athlete?: string }> }) {
 const access=await requireRenderAccess();
 const staff=access.roles.some(role=>role==="admin"||role==="coach");
 const players=staff?await loadStaffAthleteChoices(access):[];
 // ?athlete= preselects a player from a profile's Make Graphic button; only a choice the viewer may already export.
 const requested=(await searchParams).athlete;
 const initialAthleteId=requested&&(staff?players.some(p=>p.id===requested):requested===access.athleteId)?requested:undefined;
 return <><PageHeading section="Team" title="Graphics" description="Build a player card, leaderboard or comparison to share."/>
  <GraphicsStudio key={`${staff?"staff":"player"}:${access.athleteId??"none"}:${access.preview?.role??"actual"}:${initialAthleteId??""}`} initialAthleteId={initialAthleteId} staff={staff} players={players} ownAthleteId={access.athleteId}/>
 </>;
}
