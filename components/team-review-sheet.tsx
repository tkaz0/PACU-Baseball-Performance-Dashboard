import { PacificLogo } from "@/components/pacific-brand";
import { PlayerAvatar } from "@/components/player-avatar";
import { gameValue } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";
import type { BwsRaces } from "@/lib/home-spotlight";
import type { TeamRecord } from "@/lib/team-records";
import { teamCount, teamRate, teamReviewThemes, type TeamReviewColumn, type TeamReviewTrend, type TeamStatLeader } from "@/lib/team-review";
import type { ReportCardArea } from "@/lib/team-report-card";
import type { TeamGameSummary } from "@/lib/team-game-stats";
import { TOP_PERFORMER_METRICS, type TopPerformerRow } from "@/lib/top-performers";
import styles from "./team-review-sheet.module.css";

export type TeamReviewData = {
  generated: string;
  batting: TeamGameSummary | null; pitching: TeamGameSummary | null;
  reportCard: ReportCardArea[];
  trends: { columns: TeamReviewColumn[]; hitting: TeamReviewTrend[]; pitching: TeamReviewTrend[] };
  races: BwsRaces | null;
  hittingLeaders: TeamStatLeader[]; pitchingLeaders: TeamStatLeader[]; qualifiedLabel: string | null;
  hitters: TopPerformerRow[]; pitchers: TopPerformerRow[];
  records: TeamRecord[];
  headshots: Readonly<Record<string, string>>;
};

const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const SHORT_LABELS: Record<string, string> = { pitching_fb_strike_pct: "FB Strike %", pitching_breaking_strike_pct: "BRK Strike %", pitching_ch_strike_pct: "CH Strike %", batting_8plus_pct: "8+ Pitch PA %" };
function StatGrid({ summary, metrics, totals }: { summary: TeamGameSummary | null; metrics: readonly string[]; totals: [string, string][] }) {
  return <>
    <dl className={styles.statGrid}>{metrics.map(metric => { const rate = summary?.rates.find(r => r.metric === metric); const cell = teamRate(summary, metric); return cell && <div key={metric}><dt>{SHORT_LABELS[metric] ?? rate?.label ?? metric}</dt><dd data-pending={cell.pending || undefined}>{cell.value}</dd></div>; })}</dl>
    <p className={styles.totals}>{totals.map(([metric, label]) => <span key={metric}><b>{teamCount(summary, metric)}</b> {label}</span>)}</p>
  </>;
}

function Leaders({ rows, discipline, headshots }: { rows: TopPerformerRow[]; discipline: "hitting" | "pitching"; headshots: Readonly<Record<string, string>> }) {
  if (!rows.length) return <p className={styles.empty}>Needs five complete lines to rank.</p>;
  return <ol className={styles.leaders}>{rows.map(row => <li key={row.player.id}>
    <span className={styles.rank}>{row.rank}</span>
    <PlayerAvatar name={row.player.name} path={headshots[row.player.code]} size={22}/>
    <span className={styles.leaderName}>{row.player.name}<small>{TOP_PERFORMER_METRICS[discipline].map(m => { const s = row.stats[m.key]; return s ? `${m.label} ${gameValue(s.value, s.unit)}` : null; }).filter(Boolean).join(" · ")}</small></span>
    <span className={styles.score}>{row.score?.toFixed(1)}<small>{(() => { const key = discipline === "hitting" ? "qpa_pct" : "pitching_whip"; const s = row.stats[key]; return s ? gameSampleText(s.source, s.metric, s.opportunities) : ""; })()}</small></span>
  </li>)}</ol>;
}

function LeaderList({ rows }: { rows: TeamStatLeader[] }) {
  if (!rows.length) return <p className={styles.empty}>No leaders available.</p>;
  return <table className={styles.leaderTable}><tbody>{rows.map(row => <tr key={row.metric}><th scope="row">{row.label}</th><td>{row.names.join(", ")}{row.sample && <small> · {row.sample}</small>}</td><td>{row.value}</td></tr>)}</tbody></table>;
}

function Trend({ title, rows, columns }: { title: string; rows: TeamReviewTrend[]; columns: TeamReviewColumn[] }) {
  return <table className={styles.trend}>
    <thead><tr><th scope="col">{title}</th>{columns.map(c => <th key={c.key} scope="col" data-final={c.key === "fall" || undefined}>{c.label}{c.detail && <small>{c.detail}</small>}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.metric}><th scope="row">{row.label}</th>{row.cells.map((cell, i) => <td key={columns[i].key} data-final={columns[i].key === "fall" || undefined}>{cell?.value ?? "—"}</td>)}</tr>)}</tbody>
  </table>;
}

/** Team exit-meeting sheet: two light letter pages printed alongside the player handouts. Presentation only. */
export function TeamReviewSheet({ data, bundle = false }: { data: TeamReviewData; bundle?: boolean }) {
  const { working, focus } = teamReviewThemes(data.reportCard);
  const mvp = data.races?.final ? data.races.mvp?.entries.filter(e => e.rank === 1) ?? [] : [];
  const cy = data.races?.final ? data.races.cyYoung?.entries.filter(e => e.rank === 1) ?? [] : [];
  const hitters = data.batting?.players ?? 0, pitchers = data.pitching?.players ?? 0;
  return <div className={styles.sheet} data-testid="team-review-sheet" data-bundle={bundle || undefined}>
    <section className={styles.page} aria-label="Team review, front">
      <header className={styles.hero}>
        <div className={styles.heroBrand}><PacificLogo className={styles.logo} decorative/><span>Pacific Baseball · Fall 2026 Team Review</span><time dateTime={data.generated}>{day(data.generated)}</time></div>
        <h1>Fall 2026 in Review</h1>
        <p>{data.trends.columns.filter(c => c.key.startsWith("week-")).length} Fall Ball weeks{data.trends.columns.some(c => c.key === "bws") ? " + the Boxer World Series" : ""} · {hitters} hitters · {pitchers} pitchers with game stats</p>
        {(mvp.length > 0 || cy.length > 0) && <p className={styles.heroAwards}>{mvp.length > 0 && <span>🏆 BWS MVP · {mvp.map(w => w.name).join(" & ")}</span>}{cy.length > 0 && <span>🏆 BWS Cy Young · {cy.map(w => w.name).join(" & ")}</span>}</p>}
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
            <StatGrid summary={data.batting} metrics={["batting_ops", "batting_avg", "batting_obp", "batting_est_slg", "batting_est_iso", "batting_est_wobacon", "qpa_pct", "batting_hh_pct", "batting_k_pct", "batting_bb_pct", "batting_8plus_pct", "batting_sb_per_pa"]} totals={[["pa", "PA"], ["base_hit", "H"], ["pumps", "HR"], ["sb", "SB"]]}/>
          </section>
          <section className={styles.panel}><h2>Pitching · Fall Final</h2>
            <StatGrid summary={data.pitching} metrics={["pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct", "pitching_fb_strike_pct", "pitching_breaking_strike_pct", "pitching_ch_strike_pct"]} totals={[["innings_outs", "IP"], ["k", "K"], ["bb_outcome", "BB"], ["pitches", "pitches"]]}/>
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
          <h2>Fall Stat Leaders <small>{data.qualifiedLabel ? `rates among qualified players (${data.qualifiedLabel}); counting stats include everyone` : "rates among qualified players; counting stats include everyone"}</small></h2>
          <div className={styles.twoCol}><LeaderList rows={data.hittingLeaders}/><LeaderList rows={data.pitchingLeaders}/></div>
        </section>
      </div>
      <p className={styles.foot}><span>Fall 2026 team review · Front</span><span>Independent project · Not an official university application</span></p>
    </section>

    <section className={styles.page} aria-label="Team review, back">
      <div className={styles.backHead}><PacificLogo className={styles.logoSmall} decorative/><h2>Team Review</h2><span>Fall 2026 · Back</span></div>
      <div className={styles.body}>
        <section>
          <h2>Week by Week <small>team rates from each week&apos;s counts; Fall = final totals</small></h2>
          <div className={styles.trendPair}>
            <Trend title="Hitting" rows={data.trends.hitting} columns={data.trends.columns}/>
            <Trend title="Pitching" rows={data.trends.pitching} columns={data.trends.columns}/>
          </div>
        </section>
        <div className={styles.twoCol}>
          <section className={styles.panel}><h2>Top Hitters <small>Top Performer score</small></h2><Leaders rows={data.hitters} discipline="hitting" headshots={data.headshots}/></section>
          <section className={styles.panel}><h2>Top Pitchers <small>Top Performer score</small></h2><Leaders rows={data.pitchers} discipline="pitching" headshots={data.headshots}/></section>
        </div>
        <section>
          <h2>Fall Testing Records</h2>
          {data.records.length ? <ul className={styles.records}>{data.records.map(r => <li key={r.key} title={r.category}><span>{r.label}</span><b>{r.value}</b><em>{r.holders.map(h => h.name).join(", ")}</em></li>)}</ul> : <p className={styles.empty}>No testing records saved.</p>}
        </section>
        <p className={styles.method}>Team rates pool everyone&apos;s counts; — means pending or not recorded. Hitting weeks are counts added between saved QPA updates; pitching weeks are the sheet&apos;s weekly blocks. SLG/ISO/OPS count doubles and triples as doubles. Grades are dashboard bands against NWC team seasons, not official grades; Fall games face teammates. Top Performer scores blend team percentiles equally (hitters PAC Production+, QPA%, OPS; pitchers WHIP, K/BB, Runs/9).</p>
      </div>
      <p className={styles.foot}><span>Fall 2026 team review · Back</span><span>Independent project · Not an official university application</span></p>
    </section>
  </div>;
}
