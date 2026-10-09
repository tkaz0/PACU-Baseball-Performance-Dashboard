import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { RosterHeader } from "@/components/roster-header";
import { RosterTable, type RosterTableAthlete } from "@/components/roster-table";
import { StaffAthleteSearch } from "@/components/staff-athlete-search";
import { matchesStaffAthlete, staffAthleteChoice } from "@/lib/staff-athlete-search";
import { AccessPreviewNotice } from "@/components/access-preview-notice";
import styles from "@/components/roster-presentation.module.css";
import { loadTeamHeadshots } from "@/lib/headshots-server";
const POSITION_FILTERS = [
  { key: "all", label: "All Positions", match: () => true },
  { key: "pitchers", label: "Pitchers", match: (p: string) => p === "P" },
  { key: "catchers", label: "Catchers", match: (p: string) => p === "C" },
  { key: "infield", label: "Infield", match: (p: string) => ["1B", "2B", "3B", "SS", "IF"].includes(p) },
  { key: "outfield", label: "Outfield", match: (p: string) => ["LF", "CF", "RF", "OF"].includes(p) },
] as const;
const SORTS = [{ key: "name", label: "Last Name" }, { key: "jersey", label: "Jersey #" }, { key: "position", label: "Position" }, { key: "class", label: "Class" }] as const;
const POSITION_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "IF", "LF", "CF", "RF", "OF", ""];
const CLASS_ORDER = ["freshman", "sophomore", "junior", "senior", "graduate", ""];
export default async function Roster({ searchParams }: { searchParams: Promise<{ season?: string; q?: string; preview?: string; pos?: string; sort?: string }> }) {
  const access = await requireAccess();
  const { supabase, roles, athleteId, preview } = access;
  if (!roles.includes("admin") && !roles.includes("coach")) redirect(athleteId ? `/athletes/${athleteId}` : "/overview");
  const params = await searchParams;
  const { data, error } = await supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(season,jersey_number,primary_position,academic_class)").order("last_name").limit(1000);
  if (error) throw new Error("Unable to load the roster.");
  const all = (data ?? []) as RosterTableAthlete[];
  const seasons = [...new Set(all.flatMap(a => a.athlete_seasons.map(s => s.season)))].sort().reverse();
  const season = params.season && seasons.includes(params.season) ? params.season : seasons[0];
  const query = (params.q ?? "").trim().toLowerCase().slice(0,100);
  const seasonal = all.filter(a => !season || a.athlete_seasons.some(s => s.season === season));
  const pos = POSITION_FILTERS.some(f => f.key === params.pos) ? params.pos! : "all";
  const sort = SORTS.some(s => s.key === params.sort) ? params.sort! : "name";
  const seasonRow = (a: RosterTableAthlete) => a.athlete_seasons.find(s => s.season === season);
  const positionFilter = POSITION_FILTERS.find(f => f.key === pos)!;
  const athletes = seasonal.filter(a => matchesStaffAthlete(staffAthleteChoice(a), query) && positionFilter.match((seasonRow(a)?.primary_position ?? "").toUpperCase()))
    .sort((a, b) => { const x = seasonRow(a), y = seasonRow(b);
      if (sort === "jersey") return (x?.jersey_number ?? 1000) - (y?.jersey_number ?? 1000);
      if (sort === "position") return POSITION_ORDER.indexOf(x?.primary_position?.toUpperCase() ?? "") - POSITION_ORDER.indexOf(y?.primary_position?.toUpperCase() ?? "") || a.last_name.localeCompare(b.last_name);
      if (sort === "class") return CLASS_ORDER.indexOf(x?.academic_class?.toLowerCase() ?? "") - CLASS_ORDER.indexOf(y?.academic_class?.toLowerCase() ?? "") || a.last_name.localeCompare(b.last_name);
      return 0; });
  return <><AccessPreviewNotice status={params.preview} isPreview={!!preview} />
    <RosterHeader season={season} count={seasonal.length}><Link prefetch={false} href={`/roster/reports?group=${pos === "pitchers" ? "pitchers" : "all"}`} className="btn btn-secondary">Print Player Reports</Link>{roles.includes("admin") && <Link href="/admin/import" className="btn btn-secondary">Import Roster</Link>}</RosterHeader>
    <form className={`panel ${styles.toolbar}`} method="get">
      <StaffAthleteSearch athletes={seasonal.map(staffAthleteChoice)} defaultQuery={params.q} name="q" />
      <label className={styles.season}>Season<select name="season" defaultValue={season}>{!seasons.length && <option value="">No seasons yet</option>}{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className={styles.season}>Position<select name="pos" defaultValue={pos}>{POSITION_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
      <label className={styles.season}>Sort By<select name="sort" defaultValue={sort}>{SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      <button className="btn btn-secondary">Apply</button>
      <p className={styles.count}><strong>{athletes.length}</strong>{athletes.length !== seasonal.length ? ` of ${seasonal.length}` : ""} {athletes.length === 1 ? "player" : "players"}</p>
    </form>
    <RosterTable athletes={athletes} season={season} headshots={Object.fromEntries(await loadTeamHeadshots(access))} />
    {all.length === 1000 && <p className="notice mt-4">Showing the first 1,000 identities. Narrow your search to find a player.</p>}
  </>;
}
