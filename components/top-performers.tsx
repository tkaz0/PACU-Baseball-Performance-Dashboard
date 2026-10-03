"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";
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
function ScoreInfo({ discipline, count }: { discipline: TopDiscipline; count: number }) {
  const id = useId();
  return <span className={styles.info}>
    <button type="button" popoverTarget={id} aria-label={`About ${discipline} overall score`}><Info size={14} aria-hidden="true"/></button>
    <span id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className={styles.explanation}>
      <strong id={`${id}-title`}>Overall Score · 0–100</strong>
      <button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close ranking explanation"><X size={17} aria-hidden="true"/></button>
      <p>Each stat becomes a team percentile. We average those percentiles, with equal weight for every stat.</p>
      <ul>{TOP_PERFORMER_METRICS[discipline].map(metric => <li key={metric.key}>{metric.label}: {discipline === "hitting" ? "25%" : "⅓"} of the score · {metric.direction === "lower" ? "lower" : "higher"} is better</li>)}</ul>
      <p>Compared with {count} {discipline === "hitting" ? "hitters" : "pitchers"} who have all required stats in the current cumulative Fall snapshot. At least five complete lines are needed. Tied stats share the midpoint of their percentile positions.</p>
      <p>This is a custom team ranking, not an MLB or college benchmark, a prediction, or a luck-adjusted talent grade. A 50 is the team-average score among complete lines. Related stats overlap. Early samples remain included; check the opportunity counts.</p>
      <p>Missing stats, including K/BB when no walks are recorded, stay unranked. Rankings use unrounded scores; equal scores share a rank.</p>
    </span>
  </span>;
}
function PerformersTable({ discipline, data, headshots }: Props & { discipline: TopDiscipline }) {
  const metrics = TOP_PERFORMER_METRICS[discipline];
  const [shown, setShown] = useState<string>(metrics[0].key);
  const rows = topPerformers(data, discipline);
  const ranked = rows.filter(row => row.score !== null).length;
  const updated = rows.flatMap(row => Object.values(row.stats).flatMap(g => g ? [g.updatedAt] : [])).sort().at(-1);
  return <section className={styles.panel} aria-label={discipline === "hitting" ? "Top Hitters" : "Top Pitchers"}>
    <header className={styles.header}><div><p>Fall 2026 · Cumulative</p><h2>{discipline === "hitting" ? "Hitters" : "Pitchers"}</h2></div><span>{ranked} ranked · {rows.length} with stats</span></header>
    <p className={styles.blend}>{discipline === "hitting" ? "PAC Production+ · QPA% · OBP · ISO" : "WHIP · K/BB · Runs/9"}<span>One ranking. Every stat carries equal weight.</span></p>
    <div className={styles.sort} aria-label={`${discipline} stat to display`}><span>View stat</span>{metrics.map(m => <button key={m.key} type="button" aria-pressed={shown === m.key} onClick={() => setShown(m.key)}>{m.label}</button>)}</div>
    {rows.length ? <div className={styles.scroll}><table className={styles.table}><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col" aria-sort="descending" className={styles.scoreHeading}>Overall Score <ScoreInfo discipline={discipline} count={rows[0].cohortSize}/></th>{metrics.map(m => <th key={m.key} scope="col" data-selected={shown === m.key || undefined}><span className={styles.desktopMetric}>{m.label}</span><span className={styles.mobileMetric}>{m.key === "batting_production_plus" ? "PAC+" : m.label}</span> <StatInfo metric={m.key} label={m.label} unit={m.unit} source={discipline === "hitting" ? "qpa_fall_2026" : "pitching_fall_2026"} period="fall_2026"/></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.player.id}>
      <td className={styles.rank}>{row.rank ?? "—"}</td>
      <th scope="row"><div className={styles.player}><PlayerAvatar name={row.player.name} path={headshots?.[row.player.code]} size={36}/><div><Link prefetch={false} href={`/athletes/${row.player.id}`}>{row.player.name}</Link><small>{[row.player.position, row.player.secondaryPosition].filter((p, i, list) => p && list.indexOf(p) === i).join(" / ")} · {row.player.academicClass || "Class pending"}</small></div></div></th>
      <td className={styles.score}>{row.score !== null ? <><strong>{row.score.toFixed(1)}<span>/100</span></strong><div className={styles.scoreTrack} aria-hidden="true"><i style={{width: `${row.score}%`}}/></div></> : <><span aria-label="Overall score not yet available">—</span><small>{row.pending === "missing_stats" ? `Needs ${metrics.filter(m => !row.stats[m.key]).map(m => m.label).join(", ")}` : row.pending === "small_cohort" ? "Needs 5 complete lines" : "Source review needed"}</small></>}</td>
      {metrics.map(m => {
        const game = row.stats[m.key];
        return <td key={m.key} className={styles.metric} data-selected={shown === m.key || undefined}>{game ? <><strong>{gameValue(game.value, game.unit)}</strong><small>{gameSampleText(game.source, game.metric, game.opportunities)}{isEarlyGameSample(game.source, game.metric, game.opportunities) && <em>Early sample</em>}</small></> : <span aria-label="Not yet available">—</span>}</td>;
      })}
    </tr>)}</tbody></table></div> : <p className={styles.empty}>Rankings will appear as game stats are recorded.</p>}
    <footer className={styles.footer}>{updated && <span>Updated {leaderboardTestDate(pacificTestingDate(new Date(updated)))}. </span>}Team-relative score from complete stat lines; early samples remain included. {discipline === "hitting" ? "ISO treats combined doubles/triples as doubles." : "Runs/9 includes all runs allowed."}</footer>
  </section>;
}
