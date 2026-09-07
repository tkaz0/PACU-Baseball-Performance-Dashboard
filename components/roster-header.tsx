import { PacificLogo } from "@/components/pacific-brand";
import styles from "./roster-presentation.module.css";

export function RosterHeader({ season, count, children }: { season?: string; count: number; children?: React.ReactNode }) {
  return <header className={styles.header}>
    <div className={styles.identity}>
      <PacificLogo decorative className={styles.logo} />
      <div><p className={styles.eyebrow}>Pacific Baseball{season && <span> / {season.replace("-", "–")}</span>}</p>
        <h1>Team Roster</h1><p className={styles.description}>Player profiles, testing results, and progress over time.</p>
      </div>
    </div>
    <div className={styles.summary}><p><strong>{count}</strong><span>{count === 1 ? "Player" : "Players"}</span></p>{children}</div>
  </header>;
}
