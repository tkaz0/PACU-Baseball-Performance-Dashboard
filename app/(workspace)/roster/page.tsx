import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { RosterHeader } from "@/components/roster-header";
import { RosterTable, type RosterTableAthlete } from "@/components/roster-table";
import { StaffAthleteSearch } from "@/components/staff-athlete-search";
import { matchesStaffAthlete, staffAthleteChoice } from "@/lib/staff-athlete-search";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import styles from "@/components/roster-presentation.module.css";
export default async function Roster({ searchParams }: { searchParams: Promise<{ season?: string; q?: string; preview?: string }> }) {
  const { supabase, roles, athleteId, preview } = await requireAccess();
  if (!roles.includes("admin") && !roles.includes("coach")) redirect(athleteId ? `/athletes/${athleteId}` : "/overview");
  const params = await searchParams;
  const { data, error } = await supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(season,jersey_number,primary_position,academic_class)").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load the roster.");
  const all = (data ?? []) as RosterTableAthlete[];
  const seasons = [...new Set(all.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse();
  const season = params.season && seasons.includes(params.season) ? params.season : seasons[0];
  const query = (params.q ?? "").trim().toLowerCase().slice(0,100);
  const seasonal = all.filter(a => !season || a.athlete_seasons.some(s => s.season === season));
  const athletes = seasonal.filter(a => matchesStaffAthlete(staffAthleteChoice(a), query));
  return <><AccessPreviewNotice status={params.preview} isPreview={!!preview} />
    <RosterHeader season={season} count={seasonal.length}>{roles.includes("admin") && <Link href="/admin/import" className="btn btn-secondary">Import Roster</Link>}</RosterHeader>
    <form className={`panel ${styles.toolbar}`} method="get">
      <StaffAthleteSearch athletes={seasonal.map(staffAthleteChoice)} defaultQuery={params.q} name="q" />
      <label className={styles.season}>Season<select name="season" defaultValue={season}>{!seasons.length && <option value="">No seasons yet</option>}{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
      <button className="btn btn-secondary">Search</button>
      <p className={styles.count}><strong>{athletes.length}</strong>{query ? ` of ${seasonal.length}` : ""} {athletes.length === 1 ? "player" : "players"}</p>
    </form>
    <RosterTable athletes={athletes} season={season} />
    {all.length === 1000 && <p className="notice mt-4">Showing the first 1,000 identities. Narrow your search to find a player.</p>}
  </>;
}
