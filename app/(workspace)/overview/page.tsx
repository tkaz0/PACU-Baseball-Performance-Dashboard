import Link from "next/link";
import { ArrowRight, UsersRound, ShieldCheck, ClipboardList } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
import type { RosterAthlete } from "@/lib/types";
export default async function Overview() {
  const { supabase, roles, athleteId } = await requireAccess();
  const staff = roles.includes("admin") || roles.includes("coach");
  const { data, error, count } = await supabase.from("athletes").select("*, athlete_seasons(*)", { count: "exact" }).order("last_name").limit(5);
  if (error) throw new Error("Unable to load the overview.");
  const athletes = (data ?? []) as RosterAthlete[];
  return <><PageHeading section="Team workspace" title={staff ? "Team overview" : "Your overview"} description={staff ? "Your roster, athlete profiles, and access in one place." : "Your athlete identity and roster information."}>{roles.includes("admin") && <Link href="/admin/import" className="btn btn-primary">Import roster <ArrowRight size={16} /></Link>}</PageHeading>
    <section className="mb-8 grid gap-5 md:grid-cols-3" aria-label="Workspace summary">{[{ label: staff ? "Athlete identities" : "Linked athlete", value: String(count ?? 0), detail: staff ? "Across all imported seasons" : athleteId ? "Profile connected to your account" : "Awaiting administrator assignment", icon: UsersRound },{label: "Your access", value: roles.map(r => r[0].toUpperCase()+r.slice(1)).join(" + "),detail: "Managed by your administrator",icon: ShieldCheck},{label: "Performance measurements",value: "No data yet",detail: "Measurement imports are a future phase",icon: ClipboardList}].map(({label,value,detail,icon:Icon}) => <div className="panel p-6" key={label}><div className="mb-5 flex items-center justify-between"><p className="mb-0 text-sm text-gray-500">{label}</p><Icon size={18} className="text-gray-400" /></div><p className="mb-2 text-2xl font-bold tracking-tight">{value}</p><p className="mb-0 text-xs text-gray-500">{detail}</p></div>)}</section>
    <div className="mb-4 flex items-center justify-between"><h2 className="mb-0 text-lg font-bold">{staff ? "Roster at a glance" : "Your athlete profile"}</h2>{staff && <Link href="/roster" className="flex items-center gap-2 text-sm font-semibold text-pacu-red">View roster <ArrowRight size={16} /></Link>}</div><RosterTable athletes={athletes} />
    <div className="panel mt-7 flex flex-col justify-between gap-4 border-l-4 border-l-pacu-red p-6 sm:flex-row"><div><p className="eyebrow mb-2 text-pacu-red">Phase 01</p><h2 className="mb-1 text-lg font-semibold">Start with a reliable roster.</h2><p className="muted mb-0 text-sm">Athlete identities stay consistent as seasons and jersey numbers change.</p></div>{roles.includes("admin") && <Link className="btn btn-secondary self-start" href="/admin/access">Manage account access</Link>}</div>
  </>;
}
