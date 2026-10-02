"use client";
import { useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { StatInfo } from "@/components/stat-info";
import { TOP_PERFORMER_METRICS, topPerformers, type TopDiscipline } from "@/lib/top-performers";
import type { CoachingGame, CoachingPlayer } from "@/lib/coaching-tools";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText, isEarlyGameSample } from "@/lib/game-opportunities";
import { leaderboardTestDate } from "@/lib/leaderboards";
import { pacificTestingDate } from "@/lib/testing-checklist";
import styles from "./top-performers.module.css";

type Props = { data: { players: CoachingPlayer[]; games: CoachingGame[] }; headshots?: Readonly<Record<string, string>> };
export function TopPerformers({ data, headshots = {} }: Props) {
  return <div className={styles.grid}>{(["hitting", "pitching"] as const).map(discipline => <PerformersTable key={discipline} discipline={discipline} data={data} headshots={headshots}/>)}</div>;
}
function PerformersTable({ discipline, data, headshots }: Props & { discipline: TopDiscipline }) {
  const metrics = TOP_PERFORMER_METRICS[discipline];
  const [sort, setSort] = useState<string>(metrics[0].key);
  const rows = topPerformers(data, discipline, sort);
  const updated = rows.flatMap(row => Object.values(row.stats).flatMap(g => g ? [g.updatedAt] : [])).sort().at(-1);
  return <section className={styles.panel} aria-label={discipline === "hitting" ? "Top Hitters" : "Top Pitchers"}>
    <header className={styles.header}><div><p>Fall 2026 · Cumulative</p><h2>{discipline === "hitting" ? "Hitters" : "Pitchers"}</h2></div><span>{rows.length} players</span></header>
    <div className={styles.sort} aria-label={`Rank ${discipline} by`}>{metrics.map(m => <button key={m.key} type="button" aria-pressed={sort === m.key} onClick={() => setSort(m.key)}>{m.label}</button>)}</div>
    {rows.length ? <div className={styles.scroll}><table className={styles.table}><thead><tr><th scope="col">Rank</th><th scope="col">Player</th>{metrics.map(m => <th key={m.key} scope="col" data-selected={sort === m.key || undefined} aria-sort={sort === m.key ? m.direction === "lower" ? "ascending" : "descending" : undefined}>{m.label} <StatInfo metric={m.key} label={m.label} unit={m.unit} source={discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026"} period="fall_2026"/></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.player.id}><td className={styles.rank}>{row.rank ?? "—"}</td><th scope="row"><div className={styles.player}><PlayerAvatar name={row.player.name} path={headshots?.[row.player.code]} size={36}/><div><Link prefetch={false} href={`/athletes/${row.player.id}`}>{row.player.name}</Link><small>{[row.player.position, row.player.secondaryPosition].filter((p, i, list) => p && list.indexOf(p) === i).join(" / ")} · {row.player.academicClass || "Class pending"}</small></div></div></th>{metrics.map(m => {
      const game = row.stats[m.key];
      return <td key={m.key} data-selected={sort === m.key || undefined}>{game ? <><strong>{gameValue(game.value, game.unit)}</strong><small>{gameSampleText(game.source, game.metric, game.opportunities)}{isEarlyGameSample(game.source, game.metric, game.opportunities) && <em>Early sample</em>}</small></> : <span aria-label="Not yet available">—</span>}</td>;
    })}</tr>)}</tbody></table></div> : <p className={styles.empty}>Rankings will appear as game stats are recorded.</p>}
    <footer className={styles.footer}>{updated && <span>Updated {leaderboardTestDate(pacificTestingDate(new Date(updated)))}. </span>}{discipline === "hitting" ? "ISO treats combined doubles/triples as doubles. " : "Runs/9 includes all runs allowed. "}Rankings include early samples; tied results share a rank.</footer>
  </section>;
}
