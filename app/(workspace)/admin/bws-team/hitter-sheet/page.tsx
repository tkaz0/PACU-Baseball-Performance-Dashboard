import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { loadBwsHitterSheet } from "@/lib/bws-arsenal-sheet-server";
import { PrintButton } from "@/components/print-button";
import { BwsSheetPdfButton } from "@/components/bws-sheet-pdf";
import { PacificLogo } from "@/components/pacific-brand";
import { pacificTestingDate } from "@/lib/testing-checklist";
import styles from "../arsenal-sheet/arsenal-sheet.module.css";

export const metadata = { title: "BWS Hitter Sheet" };
const ROWS = [
  [["batting_avg", "AVG"], ["batting_obp", "OBP"], ["batting_est_slg", "SLG"], ["batting_est_iso", "ISO"]],
  [["batting_k_pct", "K%"], ["batting_bb_pct", "BB%"], ["qpa_pct", "QPA%"], ["batting_hh_pct", "HH%"]],
  [["batting_8plus_pct", "8+ Pitch"], ["pumps", "HR"], ["sb", "SB"]],
] as const;

/** Printable dugout sheet of the other team's hitters from the cumulative Fall QPA sheet. */
export default async function BwsHitterSheetPage() {
  const access = await requireAdminWorkspaceAccess();
  const hitters = await loadBwsHitterSheet(access);
  const today = new Date(`${pacificTestingDate()}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return <div className={styles.page}>
    <div className={`${styles.toolbar} no-print`}><Link href="/admin/bws-team" className="btn btn-secondary"><ArrowLeft size={15} aria-hidden="true"/>BWS Team</Link><span className={styles.actions}><Link href="/admin/bws-team/arsenal-sheet" className="btn btn-secondary">Pitchers Sheet</Link><BwsSheetPdfButton kind="hitters" hitters={hitters} title="Opposing Hitters · Scouting" subtitle={`Boxer World Series · ${today} · ${hitters.length} hitters · Fall 2026 QPA sheet · best OPS first`} footnote={'Cumulative Fall QPA sheet results; SLG/ISO count doubles and triples as doubles. Cues use simple planning cutoffs: Power ISO .200+, Patient BB% 12+, Strikes out K% 25+, Tough to K K% under 10, Runs 2+ SB. Recorded Fall results, not predictions.'} fileName={`bws-opposing-hitters-${pacificTestingDate()}.pdf`}/><PrintButton label="Print"/></span></div>
    <header className={styles.header}>
      <PacificLogo variant="athletics" tone="light" decorative className={styles.logo}/>
      <div><h1>Opposing Hitters · Scouting</h1><p>Boxer World Series · {today} · {hitters.length} hitters · Fall 2026 QPA sheet · best OPS first</p></div>
    </header>
    {!hitters.length ? <p className={styles.empty}>No opposing hitters with saved results. Check your BWS roster and Scouting hides.</p> :
    <div className={styles.grid}>{hitters.map(h => <section key={h.id} className={styles.card} aria-label={h.name}>
      <div className={styles.top}>
        <h2>{h.name}</h2>
        <span className={styles.hand} data-hand={h.bats === "L" ? "L" : h.bats === "S" ? "S" : undefined}>{h.bats ? `Bats ${h.bats}` : "—"}</span>
      </div>
      <p className={styles.meta}>{h.position || "—"} · {h.pa ?? "—"} PA{h.pa !== null && h.pa < 10 ? " · small sample" : ""}</p>
      <div className={styles.headline}><b>{h.stats.batting_ops?.value ?? "—"}</b><span>OPS</span>{h.tags.length > 0 && <span className={styles.tags}>{h.tags.map(t => <i key={t}>{t}</i>)}</span>}</div>
      <dl className={styles.statGrid}>{ROWS.flat().map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{h.stats[key]?.value ?? "—"}</dd></div>)}</dl>
    </section>)}</div>}
    <p className={styles.footnote}>Cumulative Fall QPA sheet results; SLG/ISO count doubles and triples as doubles. Cues use simple planning cutoffs: Power ISO .200+, Patient BB% 12+, Strikes out K% 25+, Tough to K K% under 10, Runs 2+ SB. Recorded Fall results, not predictions.</p>
  </div>;
}
