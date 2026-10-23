import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminWorkspaceAccess } from "@/lib/auth";
import { loadBwsArsenalSheet } from "@/lib/bws-arsenal-sheet-server";
import { PrintButton } from "@/components/print-button";
import { PacificLogo } from "@/components/pacific-brand";
import { pacificTestingDate } from "@/lib/testing-checklist";
import styles from "./arsenal-sheet.module.css";

export const metadata = { title: "BWS Pitch Mix Sheet" };
const ip = (outs: number | null) => outs === null ? "—" : `${Math.floor(outs / 3)}.${outs % 3}`;

/** Printable dugout sheet of the other team's pitchers: pitch-family mix and strike rates from the pitching sheet. */
export default async function BwsArsenalSheetPage() {
  const access = await requireAdminWorkspaceAccess();
  const pitchers = await loadBwsArsenalSheet(access);
  const today = new Date(`${pacificTestingDate()}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return <div className={styles.page}>
    <div className={`${styles.toolbar} no-print`}><Link href="/admin/bws-team" className="btn btn-secondary"><ArrowLeft size={15} aria-hidden="true"/>BWS Team</Link><span className={styles.actions}><Link href="/admin/bws-team/hitter-sheet" className="btn btn-secondary">Hitters Sheet</Link><PrintButton label="Print Sheet"/></span></div>
    <header className={styles.header}>
      <PacificLogo variant="athletics" tone="light" decorative className={styles.logo}/>
      <div><h1>Opposing Pitchers · Pitch Mix</h1><p>Boxer World Series · {today} · {pitchers.length} arms · Fall 2026 pitching sheet</p></div>
    </header>
    {!pitchers.length ? <p className={styles.empty}>No opposing pitchers with saved results. Check your BWS roster and Scouting hides.</p> :
    <div className={styles.grid}>{pitchers.map(p => <section key={p.id} className={styles.card} aria-label={p.name}>
      <div className={styles.top}>
        <h2>{p.name}</h2>
        <span className={styles.hand} data-hand={p.throws || undefined}>{p.throws ? `${p.throws}HP` : "—"}</span>
      </div>
      <p className={styles.meta}>{ip(p.outs)} IP{p.academicClass ? ` · ${p.academicClass}` : ""}{p.line.length ? " · " : ""}{p.line.map(l => `${l.label} ${l.value}`).join(" · ")}</p>
      {p.mix ? <>
        <div className={styles.mixBar} role="img" aria-label={`Pitch mix: ${p.mix.families.map(f => `${f.label} ${Math.round(100 * f.pitches / p.mix!.total)}%`).join(", ")}`}>
          {p.mix.families.map(f => <span key={f.key} style={{ width: `${100 * f.pitches / p.mix!.total}%`, background: f.color }}>{f.pitches / p.mix!.total >= 0.12 ? `${Math.round(100 * f.pitches / p.mix!.total)}%` : ""}</span>)}
          {p.mix.unrecorded > 0 && <span className={styles.unrecorded} style={{ width: `${100 * p.mix.unrecorded / p.mix.total}%` }}/>}
        </div>
        <ul className={styles.mixLegend}>{p.mix.families.map(f => { const s = p.familyStrike.find(x => x.label === f.label); return <li key={f.key}><i style={{ background: f.color }}/>{f.label.replace(" Family", "")} <b>{Math.round(100 * f.pitches / p.mix!.total)}%</b>{s?.strikePct != null && <> · {s.strikePct.toFixed(0)}% strikes</>}</li>; })}</ul>
        <p className={styles.small}>{p.mix.total} game pitches{p.mix.unrecorded ? ` · ${p.mix.unrecorded} family not recorded` : ""}</p>
      </> : <p className={styles.small}>No game-sheet pitch mix yet.</p>}
    </section>)}</div>}
    <p className={styles.footnote}>Mix and strike rates: cumulative Fall pitching sheet (fastball / breaking ball / changeup families). Recorded Fall results, not predictions.</p>
  </div>;
}
