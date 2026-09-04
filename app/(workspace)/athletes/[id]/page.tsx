import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { athleteName, display, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, roles } = await requireAccess();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this athlete profile.");
  if (!data) notFound();
  const a = data as RosterAthlete;
  const seasons = [...a.athlete_seasons].sort((a,b) => b.season.localeCompare(a.season));
  const staff = roles.includes("admin") || roles.includes("coach");
  return <><Link href={staff ? "/roster" : "/overview"} className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft size={16} />{staff ? "Master roster" : "Overview"}</Link><section className="panel mb-6 border-t-4 border-t-pacu-red p-7"><p className="eyebrow text-pacu-red">Athlete profile</p><div className="flex flex-wrap items-center gap-5"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-600">{(a.preferred_name || a.first_name)[0]}{a.last_name[0]}</span><div><h1 className="mb-2 text-3xl font-bold tracking-tight">{athleteName(a)}</h1><p className="mb-0 font-mono text-sm text-gray-500">{a.athlete_code}</p></div></div><dl className="field-grid mt-8"><div><dt>Official roster name</dt><dd>{a.first_name} {a.last_name}</dd></div><div><dt>Pacific email</dt><dd>{display(a.pacific_email)}</dd></div><div><dt>Preferred name</dt><dd>{display(a.preferred_name)}</dd></div></dl></section>
    {seasons.length ? seasons.map(s => <section className="panel mb-6 p-7" key={s.season}><div className="mb-6 flex items-center justify-between"><h2 className="mb-0 text-lg font-bold">Season {s.season}</h2><span className={`badge capitalize ${s.roster_status === "active" ? "badge-green" : ""}`}>{display(s.roster_status)}</span></div><dl className="field-grid">{[["Jersey number",s.jersey_number],["Primary position",s.primary_position],["Secondary position",s.secondary_position],["Player type",s.player_type],["Bats / throws",`${display(s.bats)} / ${display(s.throws)}`],["Academic class",s.academic_class],["Eligibility year",s.eligibility_year],["Graduation year",s.graduation_year]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd className="capitalize">{display(value)}</dd></div>)}</dl></section>) : <p className="notice mb-6">No season roster has been imported for this athlete.</p>}
    <section className="panel p-7"><div className="mb-5 flex items-center gap-2"><Activity className="text-pacu-red" size={19} /><h2 className="mb-0 text-lg font-bold">Performance measurements</h2></div><div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-9 text-center"><p className="mb-2 font-semibold">No data yet.</p><p className="muted mb-0 text-sm">Performance imports will be added in a future phase.</p></div></section></>;
}
