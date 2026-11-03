import { PacificLogo } from "@/components/pacific-brand";
import { PlayerAvatar } from "@/components/player-avatar";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";
import type { BwsRaces, SpotlightWeek } from "@/lib/home-spotlight";
import type { TeamRecord } from "@/lib/team-records";
import { teamCount, teamRate, teamReviewThemes, type TeamReviewColumn, type TeamReviewTrend } from "@/lib/team-review";
import type { ReportCardArea } from "@/lib/team-report-card";
import type { TeamGameSummary } from "@/lib/team-game-stats";
import { TOP_PERFORMER_METRICS, type TopPerformerRow } from "@/lib/top-performers";
import styles from "./team-review-sheet.module.css";

export type TeamReviewData = {
  generated: string;
  batting: TeamGameSummary | null; pitching: TeamGameSummary | null;
  reportCard: ReportCardArea[];
  trends: { columns: TeamReviewColumn[]; hitting: TeamReviewTrend[]; pitching: TeamReviewTrend[] };
  races: BwsRaces | null; weeks: SpotlightWeek[];
  hitters: TopPerformerRow[]; pitchers: TopPerformerRow[];
  records: TeamRecord[];
  headshots: Readonly<Record<string, string>>;
};

const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function StatGrid({ summary, metrics, totals }: { summary: TeamGameSummary | null; metrics: readonly string[]; totals: [string, string][] }) {
  return <>
    <dl className={styles.statGrid}>{metrics.map(metric => { const rate = summary?.rates.find(r => r.metric === metric); const cell = teamRate(summary, metric); return cell && <div key={metric}><dt>{rate?.label ?? metric}</dt><dd data-pending={cell.pending || undefined}>{cell.value}</dd></div>; })}</dl>
    <p className={styles.totals}>{totals.map(([metric, label]) => <span key={metric}><b>{teamCount(summary, metric)}</b> {label}</span>)}</p>
  </>;
}

function Leaders({ rows, discipline, headshots }: { rows: TopPerformerRow[]; discipline: "hitting" | "pitching"; headshots: Readonly<Record<string, string>> }) {
  if (!rows.length) return <p className={styles.empty}>Needs five complete lines to rank.</p>;
  return <ol className={styles.leaders}>{rows.map(row => <li key={row.player.id}>
    <span className={styles.rank}>{row.rank}</span>
    <PlayerAvatar name={row.player.name} path={headshots[row.player.code]} size={26}/>
    <span className={styles.leaderName}>{row.player.name}<small>{TOP_PERFORMER_METRICS[discipline].map(m => { const s = row.stats[m.key]; return s ? `${m.label} ${gameValue(s.value, s.unit)}` : null; }).filter(Boolean).join(" · ")}</small></span>
    <span className={styles.score}>{row.score?.toFixed(1)}<small>{(() => { const key = discipline === "hitting" ? "qpa_pct" : "pitching_whip"; const s = row.stats[key]; return s ? gameSampleText(s.source, s.metric, s.opportunities) : ""; })()}</small></span>
  </li>)}</ol>;
}

function Trend({ title, rows, columns }: { title: string; rows: TeamReviewTrend[]; columns: TeamReviewColumn[] }) {
  return <table className={styles.trend}>
    <thead><tr><th scope="col">{title}</th>{columns.map(c => <th key={c.key} scope="col" data-final={c.key === "fall" || undefined}>{c.label}{c.detail && <small>{c.detail}</small>}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.metric}><th scope="row">{row.label}</th>{row.cells.map((cell, i) => <td key={columns[i].key} data-final={columns[i].key === "fall" || undefined}>{cell?.value ?? "—"}</td>)}</tr>)}</tbody>
  </table>;
}

/** Team exit-meeting sheet: two light letter pages printed alongside the player handouts. Presentation only. */
export function TeamReviewSheet({ data }: { data: TeamReviewData }) {
  const { working, focus } = teamReviewThemes(data.reportCard);
  const mvp = data.races?.final ? data.races.mvp?.entries.filter(e => e.rank === 1) ?? [] : [];
  const cy = data.races?.final ? data.races.cyYoung?.entries.filter(e => e.rank === 1) ?? [] : [];
  const hitters = data.batting?.players ?? 0, pitchers = data.pitching?.players ?? 0;
  return <div className={styles.sheet} data-testid="team-review-sheet">
    <section className={styles.page} aria-label="Team review, front">
      <header className={styles.hero}>
        <div className={styles.heroBrand}><PacificLogo className={styles.logo} decorative/><span>Pacific Baseball · Fall 2026 Team Review</span><time dateTime={data.generated}>{day(data.generated)}</time></div>
        <h1>Fall 2026 in Review</h1>
        <p>{data.trends.columns.filter(c => c.key.startsWith("week-")).length} Fall Ball weeks{data.trends.columns.some(c => c.key === "bws") ? " + the Boxer World Series" : ""} · {hitters} hitters · {pitchers} pitchers with game stats</p>
        <span className={styles.watermark} aria-hidden="true">2026</span>
      </header>
      <div className={styles.body}>
        <section>
          <h2>Team Report Card <small>vs NWC teams 2016–2026 · A = top fifth, F = bottom fifth</small></h2>
          <div className={styles.cardGrid}>{data.reportCard.map(area => <div key={area.key} className={styles.grade} data-level={area.level}>
            <b>{area.grade}</b><span><strong>{area.label}</strong><small>{area.statLabel} {area.value} · {area.band}</small></span>
          </div>)}</div>
        </section>
        <div className={styles.twoCol}>
          <section className={styles.panel}><h2>Hitting · Fall Final</h2>
            <StatGrid summary={data.batting} metrics={["batting_ops", "batting_obp", "batting_est_slg", "batting_est_iso", "qpa_pct", "batting_k_pct", "batting_bb_pct", "batting_hh_pct"]} totals={[["pa", "PA"], ["base_hit", "H"], ["pumps", "HR"], ["sb", "SB"]]}/>
          </section>
          <section className={styles.panel}><h2>Pitching · Fall Final</h2>
            <StatGrid summary={data.pitching} metrics={["pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct"]} totals={[["innings_outs", "IP"], ["k", "K"], ["bb_outcome", "BB"], ["pitches", "pitches"]]}/>
          </section>
        </div>
        <div className={styles.twoCol}>
          <section className={styles.panel} data-tone="good"><h2>What&apos;s Working</h2>
            {working.length ? <ul className={styles.themes}>{working.map(a => <li key={a.key}><b>{a.grade}</b> {a.label}: {a.statLabel} {a.value} ({a.band})</li>)}</ul> : <p className={styles.empty}>No area graded B or better.</p>}
          </section>
          <section className={styles.panel} data-tone="focus"><h2>Winter Focus Areas</h2>
            {focus.length ? <ul className={styles.themes}>{focus.map(a => <li key={a.key}><b>{a.grade}</b> {a.label}: {a.statLabel} {a.value}{a.next ? ` · for a ${a.next.grade}: ${a.next.direction === "lower" ? "under" : "at least"} ${a.next.target}` : ""}</li>)}</ul> : <p className={styles.empty}>No area graded D or F.</p>}
          </section>
        </div>
        <section>
          <h2>Awards</h2>
          <div className={styles.awards}>
            {[["BWS MVP", mvp], ["BWS Cy Young", cy]].map(([title, winners]) => <div key={title as string} className={styles.award}>
              <span className={styles.trophy}>🏆 {title as string}</span>
              {(winners as typeof mvp).length ? (winners as typeof mvp).map(w => <span key={w.code} className={styles.winner}><PlayerAvatar name={w.name} path={data.headshots[w.code]} size={30}/><b>{w.name}</b><small>{w.headline.value} {w.headline.label}</small></span>) : <small className={styles.empty}>Not final</small>}
            </div>)}
          </div>
          <table className={styles.potw}>
            <thead><tr><th scope="col">Players of the Week</th><th scope="col">Hitter</th><th scope="col">Pitcher</th></tr></thead>
            <tbody>{[...data.weeks].sort((a, b) => a.week - b.week).map(w => <tr key={w.week}><th scope="row">{w.label}</th>
              {[w.hitting, w.pitching].map((c, i) => <td key={i}>{c ? <>{c.name}{c.tied ? " (tied)" : ""} <small>{c.headline.value} {c.headline.label}</small></> : <small>Not ranked</small>}</td>)}</tr>)}</tbody>
          </table>
        </section>
      </div>
      <p className={styles.foot}><span>Fall 2026 team review · Front</span><span>Independent project · Not an official university application</span></p>
    </section>

    <section className={styles.page} aria-label="Team review, back">
      <div className={styles.backHead}><PacificLogo className={styles.logoSmall} decorative/><h2>Team Review</h2><span>Fall 2026 · Back</span></div>
      <div className={styles.body}>
        <section>
          <h2>Week by Week <small>team rates from each week&apos;s counts; Fall = final totals</small></h2>
          <Trend title="Hitting" rows={data.trends.hitting} columns={data.trends.columns}/>
          <Trend title="Pitching" rows={data.trends.pitching} columns={data.trends.columns}/>
        </section>
        <div className={styles.twoCol}>
          <section className={styles.panel}><h2>Top Hitters <small>Top Performer score</small></h2><Leaders rows={data.hitters} discipline="hitting" headshots={data.headshots}/></section>
          <section className={styles.panel}><h2>Top Pitchers <small>Top Performer score</small></h2><Leaders rows={data.pitchers} discipline="pitching" headshots={data.headshots}/></section>
        </div>
        <section>
          <h2>Fall Testing Records</h2>
          {data.records.length ? <ul className={styles.records}>{data.records.map(r => <li key={r.key}><span>{r.label}<small>{r.category}</small></span><b>{r.value}</b><em>{r.holders.map(h => h.name).join(", ")}</em></li>)}</ul> : <p className={styles.empty}>No testing records saved.</p>}
        </section>
        <section className={styles.notes}><h2>Team Goals for the Winter</h2>{Array.from({ length: 4 }, (_, i) => <span key={i}/>)}</section>
        <p className={styles.method}>Team rates pool every player&apos;s counts (never averages of player rates); pending rates show —. Hitting weeks are counts added between saved QPA updates and may not match calendar weeks exactly; pitching weeks are the sheet&apos;s weekly blocks. SLG/ISO/OPS count doubles and triples as doubles. Grades compare Pacific&apos;s Fall rates with NWC team seasons and are dashboard bands, not official grades; Fall games face Pacific teammates, not conference opponents. Top Performer scores blend team percentiles equally (hitters PAC Production+, QPA%, OPS; pitchers WHIP, K/BB, Runs/9).</p>
      </div>
      <p className={styles.foot}><span>Fall 2026 team review · Back</span><span>Independent project · Not an official university application</span></p>
    </section>
  </div>;
}
