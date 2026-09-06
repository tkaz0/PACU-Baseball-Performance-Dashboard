import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, UsersRound, Activity, CalendarDays } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
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
    <PageHeading section="Pacific Baseball" title="Team Overview" description="Fall 2026 player profiles and shared performance results.">{roles.includes("admin") && <Link href="/admin/rollout" className="btn btn-primary">Team rollout <ArrowRight size={16} /></Link>}</PageHeading>
    <section className="mb-8 grid gap-5 md:grid-cols-3" aria-label="Workspace summary">{[
      {label:"Player profiles",value:String(athletes.length),detail:"2026–27 roster",icon:UsersRound},
      {label:"Last Tested",value:testedDate,detail:"Most recent recorded testing date",icon:Activity},
      {label:"Baseball stats",value:"Fall 2026",detail:"September–December results",icon:CalendarDays},
    ].map(({label,value,detail,icon:Icon}) => <div className="panel p-6" key={label}><div className="mb-5 flex items-center justify-between"><p className="mb-0 text-sm text-gray-500">{label}</p><Icon size={18} className="text-gray-400" /></div><p className="mb-2 text-2xl font-bold tracking-tight">{value}</p><p className="mb-0 text-xs text-gray-500">{detail}</p></div>)}</section>
    <div className="mb-4 flex items-center justify-between"><h2 className="mb-0 text-lg font-bold">Roster at a Glance</h2><Link href="/roster" className="flex items-center gap-2 text-sm font-semibold text-pacu-red">View all profiles <ArrowRight size={16} /></Link></div>
    <RosterTable athletes={athletes.slice(0,5)} season="2026-27" />
    {canImportPresentedAccess(access) && <div className="panel mt-7 flex flex-col justify-between gap-4 border-l-4 border-l-pacu-red p-6 sm:flex-row"><div><h2 className="mb-1 text-lg font-semibold">Add Testing Data</h2><p className="muted mb-0 text-sm">Add a file, review the values, and update player profiles.</p></div><Link className="btn btn-secondary self-start" href="/imports">Information Imports</Link></div>}
  </>;
}
