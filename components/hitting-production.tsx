import { StatInfo } from "@/components/stat-info";
import type { HittingProduction } from "@/lib/hitting-production";
import styles from "./hitting-production.module.css";

const colors: Record<string, string> = { singles: "#c8102e", xbh: "#e0a526", hr: "#367ea3", free: "#8a8f98" };

export function HittingProductionChart({ production, team = false }: { production: HittingProduction | null; team?: boolean }) {
  if (!production) return null;
  return <section className={team ? styles.embedded : styles.panel} aria-label={team ? "Team production breakdown" : "Hitting production breakdown"} data-testid="hitting-production">
    <header className={styles.heading}><h3>Where Production Comes From<StatInfo metric="batting_production_plus" label="Production Breakdown"/></h3><span>{production.pa} PA{team ? ` · ${production.players} hitters` : ""}</span></header>
    {production.total > 0 ? <div className={styles.stack} role="img" aria-label={production.parts.map(p => `${p.label}: ${p.count}, ${p.points} weighted production, ${p.share.toFixed(1)}% of total`).join("; ")}>
      {production.parts.filter(p => p.points > 0).map(p => <span key={p.key} style={{width:`${p.share}%`,background:colors[p.key]}} title={`${p.label}: ${p.share.toFixed(1)}%`}/>)}
    </div> : <p className={styles.empty}>No hits or free passes recorded in this sample yet.</p>}
    <dl className={styles.parts}>{production.parts.map(p => <div key={p.key}>
      <dt><i style={{background:colors[p.key]}} aria-hidden="true"/>{p.label}</dt>
      <dd><strong>{p.count}</strong><span>{p.share.toFixed(1)}% of production</span><small>{p.count} × {p.weight} = {p.points}</small></dd>
    </div>)}</dl>
    <p className={styles.note}>Fall QPA results · Singles ×1, doubles/triples ×2, HR ×4, BB + HBP ×1. Shares use the same weighted production behind PAC Production+, not plate appearances or runs scored.</p>
  </section>;
}
