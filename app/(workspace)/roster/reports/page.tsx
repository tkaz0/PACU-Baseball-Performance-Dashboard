import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { athleteName, type RosterAthlete } from "@/lib/types";
import { profileShowsHitting, profileShowsPitching } from "@/lib/player-profile-layout";
import { PrintButton } from "@/components/print-button";
import { ReportCustomizer } from "@/components/report-customizer";
import { buildPlayerReportSheet } from "@/components/player-report-sheet";
import styles from "@/components/player-report.module.css";

export const metadata = { title: { absolute: "Roster Player Reports – Fall 2026" } };
export const maxDuration = 60;
const GROUPS = [{ key: "all", label: "Full roster" }, { key: "position", label: "Position players" }, { key: "pitchers", label: "Pitchers" }] as const;

/** Staff only: the same one-page report for each current eligible player, one per printed page. */
export default async function RosterReports({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const access = await requireAccess(["admin", "coach"]);
  if (!canImportPresentedAccess(access)) redirect("/overview");
  const requested = (await searchParams).group;
  const group = GROUPS.find(item => item.key === requested)?.key ?? "all";
  const { data, error } = await access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)").order("last_name").limit(200);
  if (error) throw new Error("Unable to load the roster.");
  const athletes = ((data ?? []) as RosterAthlete[]).filter(athlete => {
    const season = athlete.athlete_seasons.find(item => item.season === "2026-27");
    if (!season || !(season.roster_status == null || ["active", "redshirt"].includes(season.roster_status))) return false;
    return group === "all" || (group === "pitchers" ? profileShowsPitching(season) : profileShowsHitting(season));
  });
  // Bounded parallel reads: each sheet uses the same authorized readers as the single report.
  const sheets: { id: string; name: string; sheet: Awaited<ReturnType<typeof buildPlayerReportSheet>> | null }[] = [];
  for (let i = 0; i < athletes.length; i += 4) {
    const batch = athletes.slice(i, i + 4);
    sheets.push(...await Promise.all(batch.map(async athlete => ({ id: athlete.id, name: athleteName(athlete), sheet: await buildPlayerReportSheet(access, athlete).catch(() => null) }))));
  }
  const failed = sheets.filter(item => !item.sheet);
  return <div className={styles.page}>
    <div className={`${styles.actions} no-print`}><Link href="/roster" className="profile-back"><ArrowLeft size={15}/>Back to Roster</Link>
      <nav aria-label="Report group" className="leaderboard-navigation">{GROUPS.map(item => <Link key={item.key} href={`/roster/reports?group=${item.key}`} aria-current={group === item.key ? "page" : undefined}>{item.label}</Link>)}</nav>
      <PrintButton label={`Print ${sheets.length - failed.length} Reports`}/><p className="muted m-0 text-xs">One player per page. In the print window, choose “Save as PDF.”</p></div>
    {failed.length > 0 && <p role="status" className="notice no-print mb-4 text-sm">{failed.length === 1 ? "One report" : `${failed.length} reports`} could not load and {failed.length === 1 ? "is" : "are"} left out: {failed.map(item => item.name).join(", ")}.</p>}
    <ReportCustomizer>{sheets.filter(item => item.sheet).map(item => <div key={item.id} className={styles.sheetBreak}>{item.sheet}</div>)}</ReportCustomizer>
  </div>;
}
