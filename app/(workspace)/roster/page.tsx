import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { RosterTable } from "@/components/roster-table";
import type { RosterAthlete } from "@/lib/types";
export default async function Roster({ searchParams }: { searchParams: Promise<{ season?: string; q?: string }> }) {
  const { supabase, roles, athleteId } = await requireAccess();
  if (!roles.includes("admin") && !roles.includes("coach")) redirect(athleteId ? `/athletes/${athleteId}` : "/overview");
  const params = await searchParams;
  const { data, error } = await supabase.from("athletes").select("*, athlete_seasons(*)").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load the roster.");
  const all = (data ?? []) as RosterAthlete[];
  const seasons = [...new Set(all.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse();
  const season = params.season && seasons.includes(params.season) ? params.season : seasons[0];
  const query = (params.q ?? "").trim().toLowerCase().slice(0,100);
  const athletes = all.filter(a => (!season || a.athlete_seasons.some(s => s.season === season)) && `${a.first_name} ${a.preferred_name} ${a.last_name} ${a.athlete_code}`.toLowerCase().includes(query));
  return <><PageHeading section="Pacific Baseball" title="Team roster" description="Open a player to see their measurements and Fall 2026 performance.">{roles.includes("admin") && <Link href="/admin/import" className="btn btn-primary">Import roster</Link>}</PageHeading><form className="panel mb-5 flex flex-wrap items-end gap-4 p-5" method="get"><label className="min-w-[180px] flex-1">Search athletes<input name="q" placeholder="Name or athlete code" defaultValue={params.q} maxLength={100} /></label><label className="w-44">Season<select name="season" defaultValue={season}>{!seasons.length && <option value="">No seasons yet</option>}{seasons.map(s => <option key={s}>{s}</option>)}</select></label><button className="btn btn-secondary">Apply filters</button><span className="mb-3 text-sm text-gray-500">{athletes.length} athletes</span></form><RosterTable athletes={athletes} season={season} />{all.length === 1000 && <p className="notice mt-4">Showing the first 1,000 identities. This Phase 1 directory is intended for a single team.</p>}</>;
}
