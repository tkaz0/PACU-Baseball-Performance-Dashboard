"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Circle, FileSpreadsheet, Search, UsersRound } from "lucide-react";
import type { LibrarySession } from "@/lib/session-library";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { SessionRestore } from "@/components/session-restore";
import styles from "./session-library.module.css";

const dateLabel = (session: LibrarySession) => session.startDate ? `${leaderboardTestDate(session.startDate)} – ${leaderboardTestDate(session.date)}` : leaderboardTestDate(session.date);
const needsReview = (session: LibrarySession) => !!session.publication && (!session.publication.fullyPublished || session.publication.unresolvedPitchCount > 0);
function SavedPart({ active, children }: { active: boolean; children: React.ReactNode }) {
  const Icon = active ? CheckCircle2 : Circle;
  return <span className={styles.savedPart} data-saved={active}><Icon size={14} aria-hidden="true" />{children}</span>;
}

export function SessionLibrary({ sessions, canCorrect = false, allowRestore = false }: { sessions: LibrarySession[]; canCorrect?: boolean; allowRestore?: boolean }) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "in_game" | "practice" | "review">("all");
  const visible = sessions.filter(session => (filter === "all" || (filter === "review" ? needsReview(session) : session.context === filter)) &&
    [session.label, session.vendor, session.date, ...session.originalFiles, ...session.players.map(player => player.name)].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const awaiting = sessions.filter(needsReview).length;
  return <div className={styles.library}>
    <div className={styles.totals} aria-label="Saved session totals">
      <div><strong>{sessions.length}</strong><span>Saved Reports</span></div>
      <div><strong>{sessions.filter(session => session.context === "in_game").length}</strong><span>In-Game Reports</span></div>
      <div><strong>{sessions.filter(session => session.context === "practice").length}</strong><span>Practice Reports</span></div>
      <div><strong>{awaiting}</strong><span>Tracked Reviews Open</span></div>
    </div>
    <div className={styles.toolbar}>
      <div className={styles.filters} aria-label="Filter sessions">{([ ["all", "All Reports"], ["in_game", "In-Game"], ["practice", "Practice"], ["review", "Needs Review"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}{value === "review" && awaiting > 0 ? ` (${awaiting})` : ""}</button>)}</div>
      <div className={styles.search}><Search size={16} aria-hidden="true" /><label htmlFor={searchId} className="sr-only">Search report, date, or player</label><input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search report, date, or player" /></div>
    </div>
    <p className={styles.guide}>See what is saved from each file. Older reports show saved results; their original review completion was not tracked. Average and peak Blast reports stay separate.</p>
    <div className={styles.cards}>
      {visible.map(session => <article key={session.id} className={styles.card}>
        <div className={styles.cardTop}><div className={styles.reportIcon}><FileSpreadsheet size={21} aria-hidden="true" /></div><div className={styles.heading}><div className={styles.eyebrow}>{session.vendor}<span>·</span>{session.context === "in_game" ? "In-Game" : "Practice"}{session.category === "intrasquad" && <><span>·</span>Intrasquad</>}</div><h2>{session.label}</h2><p>{dateLabel(session)}</p></div><span className={styles.status} data-state={session.publication ? session.publication.fullyPublished ? "fully_published" : "needs_review" : "legacy"}>{session.publication ? session.publication.fullyPublished ? "Published" : "Review Needed" : "Saved Results"}</span></div>
        <div className={styles.metrics}><div><strong>{session.players.length}</strong><span>Players Included</span></div><div><strong>{session.hitterCount}</strong><span>With Hitting Results</span></div>{session.vendor === "Full Swing" ? <div><strong>{session.classifiedPitcherCount}</strong><span>With Pitch-Type Results</span></div> : <div><strong>{session.measurementCount}</strong><span>Saved Measurements</span></div>}</div>
        <div className={styles.parts} aria-label="Saved parts of this report"><SavedPart active={session.hitterCount > 0}>{session.hitterCount ? "Hitting Saved" : "Hitting Not Recorded"}</SavedPart>{session.vendor === "Full Swing" && <><SavedPart active={session.classifiedPitcherCount > 0}>{session.classifiedPitcherCount ? "Pitch Types Saved" : "Pitch Types Not Recorded"}</SavedPart><SavedPart active={session.contactCount > 0}>{session.contactCount ? "Contact Charts Saved" : "Contact Charts Not Recorded"}</SavedPart></>}</div>
        {!!session.publication?.unresolvedPitchCount && <p className={styles.reviewNote}>{session.publication.unresolvedPitchCount} matched pitches still need a pitch label. Open the original CSV in the Import Center to finish the review.</p>}
        {session.publication && !session.publication.fullyPublished && <p className={styles.reviewNote}><strong>Saved Results Changed.</strong> Results were changed outside this session review. Resolve the separate correction before revising this session. {canCorrect ? <Link href="/admin/csv-corrections">Review Separate Corrections</Link> : "Ask an administrator to review the separate correction."}</p>}
        <details className={styles.details}><summary><UsersRound size={15} aria-hidden="true" /> Players &amp; Saved Details<span aria-hidden="true">+</span></summary><div className={styles.detailBody}>
          {session.pitchTypes.length > 0 && <p className={styles.pitchTypes}><strong>Pitch Types</strong>{session.pitchTypes.join(" · ")}</p>}
          {session.players.length > 0 ? <ul className={styles.players}>{session.players.map(player => <li key={player.id}><Link prefetch={false} href={`/athletes/${player.id}`}>{player.name}<ArrowUpRight size={13} aria-hidden="true" /></Link><span>{[player.hitting && "Hitting", player.pitching && "Pitching", player.contactMap && "Contact Charts"].filter(Boolean).join(" · ")}</span>{canCorrect && !session.publication && session.vendor === "Full Swing" && <Link prefetch={false} className={styles.correct} href={`/admin/csv-corrections?athlete=${player.id}`}>Review Readings</Link>}</li>)}</ul> : <p className={styles.guide}>No active player results remain in this report.</p>}
          <div className={styles.fileDetails}><span>{session.measurementCount} saved measurements · {session.contactCount} contact-chart points</span>{session.publication && <><span>Revision {session.publication.revision} · {session.publication.excludedPlayerCount} export players skipped during review</span>{session.publication.removedValueCount > 0 && <span>{session.publication.removedValueCount} tracking readings removed</span>}</>}<span>Last saved {new Date(session.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" })}</span><details><summary>Original File{session.originalFiles.length === 1 ? "" : " Names"}</summary><ul>{session.originalFiles.map(file => <li key={file}>{file}</li>)}</ul></details>{session.vendor === "Full Swing" && (!session.publication || session.publication.fullyPublished) && <Link href={`/imports?sessionType=${session.category === "game" || session.category === "intrasquad" ? session.category : "practice"}`} className="btn btn-secondary">Review Original CSV</Link>}</div>
        </div></details>
        {allowRestore && session.publication && <SessionRestore key={session.id} publication={session.publication} />}
      </article>)}
    </div>
    {!visible.length && <div className={styles.empty}><FileSpreadsheet size={28} aria-hidden="true" /><h2>{sessions.length ? "No Reports Match" : "Your Sessions Will Appear Here"}</h2><p>{sessions.length ? "Try another player, date, or report filter." : "Publish a reviewed Full Swing or Blast report from the Import Center."}</p>{!sessions.length && <Link href="/imports" className="btn btn-primary">Add a Report</Link>}</div>}
  </div>;
}
