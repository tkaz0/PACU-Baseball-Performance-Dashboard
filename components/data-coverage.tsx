"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, CircleDashed, Minus, TriangleAlert, Upload } from "lucide-react";
import { COVERAGE_GROUPS, type CoverageCell, type DataCoverage as CoverageData } from "@/lib/data-coverage";
import { leaderboardTestDate } from "@/lib/leaderboards";
import styles from "./data-coverage.module.css";

const titles: Record<CoverageCell["status"], string> = { recorded: "Recorded", partial: "Partial", missing: "Needs testing", review: "Needs review", not_applicable: "Not applicable" };
function CoverageStatus({ cell, label }: { cell: CoverageCell; label: string }) {
  const Icon = cell.status === "recorded" ? Check : cell.status === "review" ? TriangleAlert : cell.status === "not_applicable" ? Minus : CircleDashed;
  return <div className={styles.cell} data-status={cell.status}><span className={styles.mobileLabel}>{label}</span>
    {cell.expected ? <details><summary><span className={styles.status}><Icon size={15} aria-hidden="true" />{titles[cell.status]}</span><span className={styles.meta}>{cell.recorded}/{cell.expected} metrics{cell.latest ? ` · ${leaderboardTestDate(cell.latest)}` : ""}</span></summary>
      <ul className={styles.metrics}>{cell.metrics.map(metric => <li key={metric.label}><span>{metric.label}</span><span>{metric.status === "missing" ? "Missing" : metric.status === "review" ? "Review same-day results" : leaderboardTestDate(metric.date!)}</span></li>)}</ul>
    </details> : <span className={`${styles.status} ${styles.meta}`}><Icon size={15} aria-hidden="true" />Not applicable</span>}
  </div>;
}
export function DataCoverage({ data }: { data: CoverageData }) {
  const [query, setQuery] = useState(""), [scope, setScope] = useState("all");
  const rows = data.rows.filter(row => `${row.player.name} ${row.player.code}`.toLowerCase().includes(query.trim().toLowerCase()) && (scope === "all" || (scope === "review" ? COVERAGE_GROUPS.some(g => row.cells[g.key].status === "review") : COVERAGE_GROUPS.some(g => row.cells[g.key].status === "missing" || row.cells[g.key].status === "partial"))));
  return <div className={styles.coverage}>
    <div className={styles.summary} aria-label="Team data coverage">{COVERAGE_GROUPS.map(group => {
      const eligible = data.rows.filter(row => row.cells[group.key].expected > 0);
      const withData = eligible.filter(row => row.cells[group.key].recorded > 0).length;
      return <section key={group.key}><h2>{group.label}</h2><p><strong>{withData}</strong><span> / {eligible.length} players with results</span></p><progress aria-label={`${group.label} players with results`} value={withData} max={Math.max(1, eligible.length)} /><span className={styles.meta}>{eligible.filter(row => row.cells[group.key].status === "missing").length} need first results · {eligible.filter(row => row.cells[group.key].status === "partial").length} partial · {eligible.filter(row => row.cells[group.key].status === "review").length} to review</span></section>;
    })}</div>
    <div className={styles.toolbar}><label>Find a player<input type="search" placeholder="Name or PAC ID" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Show<select value={scope} onChange={e => setScope(e.target.value)}><option value="all">All players</option><option value="missing">Missing or partial results</option><option value="review">Needs review</option></select></label><Link prefetch={false} className="btn btn-primary" href="/imports"><Upload size={16} aria-hidden="true" />Import Results</Link></div>
    <p className={styles.meta}>Fall 2026 · Saved tests through {leaderboardTestDate(data.today)}. Expand a status to see the individual measurements and testing dates.</p>
    <section className={styles.table} aria-label="Player measurement coverage"><div className={styles.head}><span>Player</span>{COVERAGE_GROUPS.map(g => <span key={g.key}>{g.label}</span>)}</div>
      {rows.map(row => <div className={styles.row} key={row.player.id}><div className={styles.player}><Link prefetch={false} href={`/athletes/${row.player.id}`}>{row.player.name}</Link><p className={styles.meta}>{row.player.code}{row.player.position ? ` · ${row.player.position}` : ""}</p></div>{COVERAGE_GROUPS.map(g => <CoverageStatus key={g.key} label={g.label} cell={row.cells[g.key]} />)}</div>)}
      {!rows.length && <p className={styles.empty}>{data.rows.length ? "No players match this view." : "The checklist will appear when players are added to the current roster."}</p>}
    </section>
    <p className={styles.meta}>{rows.length} of {data.rows.length} players shown. RENPHO checks height, weight, body score, muscle mass, and body fat. Hitting and throwing check the listed profile metrics for each player’s role. Partial results remain available on profiles; game-sheet totals and earlier tests do not complete this Fall testing checklist.</p>
  </div>;
}
