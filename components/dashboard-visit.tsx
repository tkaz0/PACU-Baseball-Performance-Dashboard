"use client";

import { pitchSourceLabel } from "@/lib/pitch-display";
import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { recordDashboardVisit } from "@/app/(workspace)/overview/visit-actions";
import type { DashboardVisitWindow } from "@/lib/personal-dashboard-server";
import type { VisitDigest } from "@/lib/dashboard-visit-digest";
import { formatMetricNumber } from "@/lib/measurement-display";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";
import styles from "./personal-dashboard.module.css";
const date = (v: string) => new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString("en-US", { month:"short",day:"numeric",timeZone:v.length===10?"UTC":"America/Los_Angeles" });
export function DashboardVisit({ visit, digest, staff, athleteId }: { visit: DashboardVisitWindow; digest: VisitDigest; staff: boolean; athleteId: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visit.record) return;
    let mounted = true;
    const save = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", save); recordDashboardVisit(visit.viewedAt).then(ok => { if (mounted) setFailed(!ok); }).catch(() => { if (mounted) setFailed(true); }); } };
    document.addEventListener("visibilitychange", save); save();
    return () => { mounted = false; document.removeEventListener("visibilitychange", save); };
  }, [visit.record, visit.viewedAt]);
  const href = staff ? "/testing/changes" : athleteId ? `/athletes/${athleteId}` : "/settings";
  // Nothing new: a single quiet line instead of three zero tiles.
  if (visit.since && !digest.newResults && !digest.updatedPlayers && !digest.newBests && !digest.gameSources) return <p className={styles.visitQuiet} role="status"><Sparkles size={15} aria-hidden="true"/>No new results since your last visit on {date(visit.since)}.{failed && " Visit tracking could not be updated; refresh to try again."}</p>;
  return <section className={styles.visit} aria-label="Since your last visit"><header><div><h2>Since Your Last Visit</h2><p>{!visit.record ? "Preview · Opening this view does not mark updates as seen." : visit.since ? `Newly saved Fall results since ${date(visit.since)}.` : "Welcome to your update tracker. Your next visit will highlight newly added results."}</p></div><Sparkles size={21} aria-hidden="true"/></header>
    {visit.since && <><div className={styles.visitNumbers}><Link href={href}><strong>{digest.newResults}</strong><span>New Test Results</span></Link>{staff && <Link href={href}><strong>{digest.updatedPlayers}</strong><span>Players Updated</span></Link>}<Link href={href}><strong>{digest.newBests}</strong><span>New Fall Bests</span></Link></div>{digest.gameSources>0 && <p>{digest.gameSources} game-stat {digest.gameSources===1?"source was":"sources were"} refreshed since your last visit. <Link href="/game-stats">Open Game Stats</Link></p>}{digest.bests.length>0 && <ul className={styles.bestList}>{digest.bests.map(b => { const pitch=classifiedPitchSource(b.source); return <li key={JSON.stringify([b.athleteId,b.metric,b.source,b.unit])}><div>{staff && b.playerName && <Link href={`/athletes/${b.athleteId}`}>{b.playerName} · </Link>}{pitch?`${pitchTypeLabel(pitch.pitchType)} ${b.label.replace(/^Pitch Type /,"")}`:b.label}<small>{pitchSourceLabel(b.source)} · Tested {date(b.measuredAt)}</small></div><div><strong>{formatMetricNumber(b.value,b.metric,b.source)} {b.unit}</strong><small>Previous {formatMetricNumber(b.previous,b.metric,b.source)}</small></div></li>; })}</ul>}<p>New Fall bests compare newly added results with earlier saved results from the same test, source and units.</p></>}
    {failed && <p role="status">Visit tracking could not be updated. Your saved results are unaffected; refresh to try again.</p>}
  </section>;
}
