import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { athleteName, UUID_PATTERN, type RosterAthlete } from "@/lib/types";
import { PrintButton } from "@/components/print-button";
import { ReportCustomizer } from "@/components/report-customizer";
import { buildPlayerReportSheet } from "@/components/player-report-sheet";
import styles from "@/components/player-report.module.css";

/** One authorized athlete read shared by the page and its title. */
const loadReportAthlete = cache(async (id: string) => {
  const access = await requireAccess();
  if (!UUID_PATTERN.test(id) || !canReadPresentedAthlete(access, id)) notFound();
  const { data, error } = await access.supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(*)").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load this player report.");
  if (!data) notFound();
  return { access, athlete: data as RosterAthlete };
});

/** The browser uses the title as the saved PDF's file name. Name only, never codes or IDs. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { athlete } = await loadReportAthlete((await params).id);
  return { title: { absolute: `${athleteName(athlete)} – Fall 2026 Player Report` } };
}

/** One-page printable summary of the same results the profile already shows to this viewer. */
export default async function PlayerReport({ params }: { params: Promise<{ id: string }> }) {
  const { access, athlete } = await loadReportAthlete((await params).id);
  const sheet = await buildPlayerReportSheet(access, athlete);
  return <div className={styles.page}>
    <div className={`${styles.actions} no-print`}><Link href={`/athletes/${athlete.id}`} className="profile-back"><ArrowLeft size={15}/>Back to Profile</Link><PrintButton/><p className="muted m-0 text-xs">In the print window, choose “Save as PDF.”</p></div>
    <ReportCustomizer>{sheet}</ReportCustomizer>
  </div>;
}
