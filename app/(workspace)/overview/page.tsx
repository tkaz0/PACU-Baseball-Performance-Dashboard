import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { TeamOverview } from "@/components/team-overview";
import { canImportPresentedAccess } from "@/lib/access-preview";
import type { RosterAthlete } from "@/lib/types";
export default async function Overview({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const access = await requireAccess();
  const { supabase, roles, athleteId, preview } = access;
  const params = await searchParams;
  const staff = roles.includes("admin") || roles.includes("coach");
  if (!staff && athleteId) redirect(`/athletes/${athleteId}`);
  if (!staff) return <PageHeading section="Your workspace" title="Your profile is being connected" description="Your administrator will link your account to the correct player profile." />;
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons!inner(*)").eq("athlete_seasons.season","2026-27").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load the team overview.");
  const athletes = (data ?? []) as RosterAthlete[];
  const latestTest = athletes.length ? await supabase.from("performance_measurements").select("measured_at").in("athlete_id",athletes.map(athlete => athlete.id)).gte("measured_at","2026-06-01").lte("measured_at","2026-12-31").order("measured_at", { ascending: false }).limit(1) : {data:[],error:null};
  if (latestTest.error) throw new Error("Unable to load the latest testing date.");
  const testedAt = latestTest.data?.[0]?.measured_at;
  const testedDate = testedAt ? new Intl.DateTimeFormat("en-US", {month:"short", day:"numeric", year:"numeric",timeZone:"UTC"}).format(new Date(`${testedAt}T12:00:00Z`)) : "No data yet";
  return <>
    {params.preview === "invalid" && <p role="alert" className="notice notice-error mb-6">Choose an available player profile or the coach view. Your current view has not changed.</p>}
    {params.preview === "read-only" && preview && <p role="status" className="notice mb-6">Exit preview to add or manage information. No change was saved.</p>}
    <TeamOverview athletes={athletes} testedDate={testedDate} canImport={canImportPresentedAccess(access)} />
  </>;
}
