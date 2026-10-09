import Link from "next/link";
import { Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { TEAM_RECORD_CATEGORIES, type TeamRecord } from "@/lib/team-records";
import styles from "./team-records.module.css";

export function TeamRecords({ records, headshots = {} }: { records: readonly TeamRecord[]; headshots?: Readonly<Record<string, string>> }) {
  if (!records.length) return <section className="panel px-6 py-10 text-center"><Trophy size={23} aria-hidden="true" className="mx-auto mb-3 text-[var(--accent-readable)]"/><h2 className="mb-1 text-xl font-bold">No Records Yet</h2><p className="muted m-0 text-sm">Records appear as Fall testing results are saved.</p></section>;
  return <div className={styles.sections} data-testid="team-records">
    {TEAM_RECORD_CATEGORIES.map(category => { const rows = records.filter(record => record.category === category); return rows.length ? <section key={category} aria-label={category}>
      <h2 className={styles.heading}>{category}</h2>
      <div className={styles.grid}>{rows.map(record => <article key={record.key} className={styles.card} data-record={record.key}>
        <p className={styles.label}>{record.label}</p><p className={styles.context}>{record.context} · {record.players} {record.players === 1 ? "player" : "players"}</p>
        <strong className={styles.value}>{record.value}</strong>
        <ul className={styles.holders}>{record.holders.map(holder => <li key={holder.code}><PlayerAvatar name={holder.name} path={headshots[holder.code]} size={32}/>
          <span><b>{holder.profileId ? <Link prefetch={false} href={`/athletes/${holder.profileId}`}>{holder.name}</Link> : holder.name}</b><small>{leaderboardTestDate(holder.measuredAt)}{holder.sample ? ` · ${holder.sample}` : ""}</small></span></li>)}</ul>
        {record.holders.length > 1 && <p className={styles.tied}>Shared record</p>}
      </article>)}</div>
    </section> : null; })}
    <p className="muted m-0 text-xs">Each record is the #1 result on the matching Fall leaderboard, with the same source, unit and Fall-best or Fall-average basis. Neutral body measurements and spin are not treated as records. Ties are shared.</p>
  </div>;
}
