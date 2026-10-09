import { percentileColor, ordinal } from "@/lib/percentile-color";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { leaderboardMetricLabel } from "@/lib/leaderboards";
import { formatMetricNumber } from "@/lib/measurement-display";
import { gameValue } from "@/lib/game-metrics";
import type { GameOverviewMetric } from "@/lib/game-overview";
import { isTimedMetric, type PlayerMetricCard } from "@/lib/player-performance";
import { StatInfo } from "@/components/stat-info";
import styles from "./percentile-rankings.module.css";

type Row = { key: string; label: string; value: string; percentile: number; sampleSize: number; metric: string; game: boolean; guide: { value: number; unit: string; source: string; eventId?: string } };

/**
 * Savant-style list of every directional result that already has a verified team percentile
 * (at least five comparable players). Neutral body/spin positions are descriptive and stay out.
 * No new percentiles are calculated here.
 */
export function PercentileRankings({ cards: inputCards, games }: { cards: readonly PlayerMetricCard[]; games: readonly GameOverviewMetric[] }) {
  // Each source/unit keeps its own card and cohort (e.g. In-Game and Practice bat speed).
  const cards = [...new Map(inputCards.flatMap(card => card.sourceCards?.length ? card.sourceCards : [card])
    .map(card => [JSON.stringify([card.metric.key, card.latest?.source, card.latest?.unit, card.latest?.period]), card])).values()];
  const cardRow = (card: PlayerMetricCard): Row[] => {
    const reading = card.latest, p = card.percentile;
    if (!reading || !p || card.percentileStatus !== "available" || p.sampleSize < 5 || !Number.isFinite(p.value) || p.value < 0 || p.value > 100 || card.metric.direction === "neutral") return [];
    const value = isTimedMetric(card.metric.key) && reading.unit === "s" ? `${reading.value.toFixed(2)} s` : `${formatMetricNumber(reading.value, card.metric.key, reading.source)}${reading.unit === "ratio" ? "" : ` ${reading.unit}`}`;
    return [{ key: `${card.metric.key}:${reading.source}:${reading.unit}`, label: profileMetricLabel(card.metric.key, leaderboardMetricLabel(card.metric), reading.source), value, percentile: p.value, sampleSize: p.sampleSize, metric: card.metric.key, game: false, guide: { value: reading.value, unit: reading.unit, source: reading.source } }];
  };
  const gameRow = (item: GameOverviewMetric): Row[] => {
    const c = item.comparison;
    // Counting stats depend on playing time, so only rates are ranked here.
    if (!c || c.percentile === null || !Number.isFinite(c.percentile) || c.sampleSize < 5 || item.direction === "neutral" || item.unit === "count") return [];
    return [{ key: `game:${item.source}:${item.eventId}:${item.metric}`, label: item.label, value: gameValue(item.value, item.unit), percentile: c.percentile, sampleSize: c.sampleSize, metric: item.metric, game: true, guide: { value: item.value, unit: item.unit, source: item.source, eventId: item.eventId } }];
  };
  const groups = [
    { id: "game-hitting", title: "Hitting · Game Stats", rows: games.filter(g => g.source === "qpa_fall_2026").flatMap(gameRow) },
    { id: "game-pitching", title: "Pitching · Game Stats", rows: games.filter(g => g.source !== "qpa_fall_2026").flatMap(gameRow) },
    { id: "hitting", title: "Hitting · Testing", rows: cards.filter(c => c.metric.group === "hitting" && !isTimedMetric(c.metric.key)).flatMap(cardRow) },
    { id: "speed", title: "Speed & Agility", rows: cards.filter(c => isTimedMetric(c.metric.key)).flatMap(cardRow) },
    { id: "pitching", title: "Pitching · Testing", rows: cards.filter(c => c.metric.group === "pitching" && !isTimedMetric(c.metric.key)).flatMap(cardRow) },
    { id: "throwing", title: "Throwing", rows: cards.filter(c => c.metric.group === "throwing" && !isTimedMetric(c.metric.key)).flatMap(cardRow) },
    { id: "body", title: "Strength", rows: cards.filter(c => c.metric.group === "body" && !isTimedMetric(c.metric.key)).flatMap(cardRow) },
  ].filter(group => group.rows.length > 0);
  if (!groups.length) return null;
  return <section className={styles.panel} aria-label="Percentile rankings" data-testid="percentile-rankings">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Fall 2026 · vs Pacific</p><h2>Percentile Rankings</h2></div>
      <div className={styles.scale} aria-hidden="true"><span>Poor</span><i /><span>Average</span><i /><span>Great</span></div>
    </header>
    <div className={styles.groups}>
      {groups.map(group => <div key={group.id} className={styles.group} aria-label={group.title}>
        <h3>{group.title}</h3>
        <ul>{group.rows.map(row => <li key={row.key} className={styles.row} {...(row.game ? { "data-ranking-game-metric": row.metric } : { "data-ranking-metric": row.metric })}>
          <span className={styles.label}>{row.label}<StatInfo metric={row.metric} label={row.label} value={row.guide.value} unit={row.guide.unit} source={row.guide.source} period="fall_2026" eventId={row.guide.eventId} percentile={row.percentile}/></span>
          <span className={styles.track} role="img" aria-label={`${row.label}: ${ordinal(row.percentile)} percentile of ${row.sampleSize} players`}>
            <span className={styles.fill} style={{ width: `${row.percentile}%`, background: percentileColor(row.percentile).backgroundColor }} />
            <span className={styles.bubble} style={{ left: `${row.percentile}%`, ...percentileColor(row.percentile) }}>{Math.round(row.percentile)}</span>
          </span>
          <span className={styles.value}>{row.value}</span>
        </li>)}</ul>
      </div>)}
    </div>
    <p className={styles.note}>Each bar ranks this player against Pacific teammates with the same stat, source and period (at least five players). Body size and spin are descriptive positions and are not graded here.</p>
  </section>;
}
