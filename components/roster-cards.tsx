import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { athleteName } from "@/lib/types";
import type { RosterTableAthlete } from "@/components/roster-table";
import type { RosterCardStat } from "@/lib/roster-card-stats";
import styles from "./roster-cards.module.css";

/** Card view of the staff roster: photo, jersey, positions, class and one headline Fall game stat. */
export function RosterCards({ athletes, season, headshots = {}, stats = {} }: { athletes: RosterTableAthlete[]; season?: string; headshots?: Record<string, string>; stats?: Record<string, RosterCardStat[]> }) {
  return <ul className={styles.grid} aria-label={`Athlete roster${season ? ` for ${season}` : ""}`}>{athletes.map((a, index) => {
    const s = season ? a.athlete_seasons.find(row => row.season === season) : [...a.athlete_seasons].sort((x, y) => y.season.localeCompare(x.season))[0];
    const name = athleteName(a);
    const jersey = s?.jersey_number ?? null;
    return <li key={a.id}><Link prefetch={false} href={`/athletes/${a.id}`} className={styles.card}>
      {jersey !== null && <span className={styles.number} aria-hidden="true">{jersey}</span>}
      <PlayerAvatar name={name} path={headshots[a.athlete_code]} size={64} eager={index < 12} className={styles.avatar} />
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.chips}>
          {jersey !== null && <span className={styles.chip}>#{jersey}</span>}
          {s?.primary_position && <span className={`${styles.chip} ${styles.position}`}>{s.primary_position}</span>}
          {s?.academic_class && <span className={styles.class}>{s.academic_class}</span>}
        </span>
        {(stats[a.id] ?? []).length > 0 && <span className={styles.stats}>{stats[a.id].map(stat => <span key={stat.label} className={styles.stat}><b>{stat.value}</b><small>{stat.label}{stat.sample ? ` · ${stat.sample}` : ""}</small></span>)}</span>}
      </span>
    </Link></li>;
  })}</ul>;
}
