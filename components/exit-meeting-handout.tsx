import type { ReactNode } from "react";
import { PacificLogo } from "@/components/pacific-brand";
import { PlayerAvatar } from "@/components/player-avatar";
import { Sparkline } from "@/components/charts/sparkline";
import { percentileColor, ordinal } from "@/lib/percentile-color";
import { pitchSourceLabel } from "@/lib/pitch-display";
import type { ExitMeetingReport, ExitMeetingRow, ExitMeetingSection } from "@/lib/exit-meeting";
import styles from "./exit-meeting-handout.module.css";

/**
 * Two-page (front and back) exit meeting sheet built only from the report projection, so a saved
 * snapshot renders exactly what was captured. Percentiles are the report's verified team ranks
 * (five or more teammates); missing results stay missing. Printed through the browser.
 */
const HITTING_HEADLINE = ["batting_production_plus", "batting_ops", "qpa_pct", "batting_obp"];
const PITCHING_HEADLINE = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct"];
const TESTING_HEADLINE = ["max_exit_velocity", "avg_bat_speed", "max_bat_speed"];
const LOWER_BETTER = new Set(["pitching_whip", "pitching_r9", "pitching_bb9", "batting_k_pct", "hard_contact_pct", "home_to_first", "home_to_second", "boxer_t", "body_fat_pct"]);
// Counting totals depend on playing time, so the ranking bars show rates and test results only.
const COUNTS = new Set(["pumps", "sb", "gdp", "k", "bb_outcome"]);
const RANK_ORDER = ["batting_production_plus", "batting_ops", "batting_obp", "batting_avg", "batting_est_slg", "qpa_pct", "batting_hh_pct", "batting_bb_pct", "batting_k_pct",
  "pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct", "max_exit_velocity", "avg_exit_velocity", "max_bat_speed", "avg_bat_speed", "max_distance"];
const rankIndex = (key?: string) => { const i = key ? RANK_ORDER.indexOf(key) : -1; return i < 0 ? RANK_ORDER.length : i; };
// Body size and composition are shown as values, not ranked bars (descriptive, not a grade).
const BODY = new Set(["height", "weight", "muscle_mass", "body_score", "body_fat_pct"]);

const section = (report: ExitMeetingReport, id: string) => report.sections.find(s => s.id === id);
const rowsOf = (s?: ExitMeetingSection) => s?.rows ?? [];
const byKey = (rows: ExitMeetingRow[], key: string) => rows.find(r => r.metricKey === key);
const day = (value: string) => /^\d{4}-\d\d-\d\d$/.test(value) ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : value;

function Ring({ value, size = 46 }: { value: number | null; size?: number }) {
  if (value === null) return <span className={styles.ringEmpty} style={{ width: size, height: size }}>—</span>;
  const pct = Math.max(0, Math.min(100, Math.round(value))), color = percentileColor(pct).backgroundColor;
  return <span className={styles.ring} style={{ width: size, height: size, background: `conic-gradient(${color} ${pct * 3.6}deg, #e5e7eb 0)` }} aria-label={`${ordinal(pct)} team percentile`}><b>{pct}</b></span>;
}

function Tile({ row }: { row: ExitMeetingRow }) {
  const [number, ...unit] = row.value.split(" ");
  return <div className={styles.tile}>
    <div><span className={styles.tileLabel}>{row.label}</span><strong className={styles.tileValue}>{number}{unit.length > 0 && <small> {unit.join(" ")}</small>}</strong><span className={styles.tileMeta}>{row.sample ?? pitchSourceLabel(row.source)}</span></div>
    <Ring value={row.percentile}/>
  </div>;
}

function Panel({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: ReactNode; className?: string }) {
  return <section className={`${styles.panel} ${className}`}><header><h3>{title}</h3>{kicker && <span>{kicker}</span>}</header>{children}</section>;
}

/** Savant-style bars: one bar per directional stat with a verified team percentile. */
function PercentileBars({ rows }: { rows: { label: string; group: string; row: ExitMeetingRow }[] }) {
  if (!rows.length) return <p className={styles.empty}>Team percentiles appear once five or more teammates have comparable results.</p>;
  return <ol className={styles.bars}>{rows.map(({ label, group, row }) => { const pct = Math.round(row.percentile!), color = percentileColor(pct); return <li key={`${group}-${label}`}>
    <span className={styles.barLabel}>{label}<small>{group}</small></span>
    <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${Math.max(4, pct)}%`, background: color.backgroundColor }}/><span className={styles.barDot} style={{ left: `${pct}%`, ...color }}>{pct}</span></span>
    <span className={styles.barValue}>{row.value}</span>
  </li>; })}</ol>;
}

function StatTable({ rows, weeks, empty }: { rows: ExitMeetingRow[]; weeks: ExitMeetingRow[]; empty: string }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  return <table className={styles.table}><thead><tr><th>Stat</th><th className={styles.num}>Fall</th><th className={styles.num}>Pctl</th><th>By Week</th></tr></thead>
    <tbody>{rows.map(row => { const week = row.metricKey ? byKey(weeks, row.metricKey) : undefined; return <tr key={row.label}>
      <td><b>{row.label}</b>{row.sample && <small>{row.sample}</small>}</td>
      <td className={styles.num}><strong>{row.value}</strong></td>
      <td className={styles.num}>{row.percentile === null ? "—" : <span className={styles.pctChip} style={percentileColor(row.percentile)}>{Math.round(row.percentile)}</span>}</td>
      <td>{week?.trend && week.trend.length >= 2 ? <span className={styles.trend}><Sparkline points={week.trend} width={84} height={22} label={`${row.label} by week`} noun="weeks" direction={row.metricKey && LOWER_BETTER.has(row.metricKey) ? "lower" : "higher"}/><small>{week.value} latest wk</small></span> : <small className={styles.muted}>—</small>}</td>
    </tr>; })}</tbody></table>;
}

function ValueGrid({ rows }: { rows: ExitMeetingRow[] }) {
  return <dl className={styles.values}>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd><small>{row.percentile !== null && row.metricKey && !BODY.has(row.metricKey) ? `${ordinal(Math.round(row.percentile))} pctl` : row.metricKey && BODY.has(row.metricKey) && row.percentile !== null ? "Team position" : day(row.date)}</small></div>)}</dl>;
}

/** Arsenal rows read "84.1 avg / 86.0 max mph"; bars scale average velocity across the pitcher's pitches. */
function Arsenal({ rows }: { rows: ExitMeetingRow[] }) {
  const velo = rows.filter(r => r.label.endsWith("· Velocity")).map(r => ({ pitch: r.label.replace(" · Velocity", ""), avg: Number.parseFloat(r.value), text: r.value, sample: r.sample }));
  const spin = new Map(rows.filter(r => r.label.endsWith("· Spin")).map(r => [r.label.replace(" · Spin", ""), r.value]));
  const top = Math.max(1, ...velo.map(v => Number.isFinite(v.avg) ? v.avg : 0));
  if (!velo.length) return null;
  return <ul className={styles.arsenal}>{velo.map(v => <li key={v.pitch}><span className={styles.pitch}>{v.pitch}</span>
    <span className={styles.arsenalTrack}><span style={{ width: `${Number.isFinite(v.avg) ? Math.max(8, v.avg / top * 100) : 0}%` }}/></span>
    <span className={styles.arsenalText}>{v.text}{spin.get(v.pitch) ? ` · ${spin.get(v.pitch)}` : ""}</span></li>)}</ul>;
}

function Insights({ title, tone, items, empty }: { title: string; tone: string; items: ExitMeetingReport["strengths"]; empty: string }) {
  return <section className={styles.insight} data-tone={tone}><h3>{title}</h3>{items.length ? <ul>{items.map((item, i) => <li key={`${item.label}-${i}`}><b>{item.label}</b>{item.percentile !== null && <span>{ordinal(Math.round(item.percentile))}</span>}<small>{item.detail}</small></li>)}</ul> : <p className={styles.empty}>{empty}</p>}</section>;
}

export function ExitMeetingHandout({ report, meetingDate, talkingPoints, headshot }: { report: ExitMeetingReport; meetingDate: string; talkingPoints: string; headshot?: string | null }) {
  const games = [...rowsOf(section(report, "game-qpa_fall_2026")), ...rowsOf(section(report, "game-pitching_fall_2026"))];
  const testing = [...rowsOf(section(report, "hitting-in_game")), ...rowsOf(section(report, "blast-fall")), ...rowsOf(section(report, "testing"))];
  const headline = [...HITTING_HEADLINE.slice(0, 3), ...PITCHING_HEADLINE.slice(0, 3)].flatMap(key => byKey(games, key) ? [byKey(games, key)!] : []);
  const tiles = [...headline, ...TESTING_HEADLINE.flatMap(key => byKey(testing, key) ? [byKey(testing, key)!] : [])].slice(0, 4);
  const ranked = [
    ...rowsOf(section(report, "game-qpa_fall_2026")).map(row => ({ label: row.label, group: "Hitting", row })),
    ...rowsOf(section(report, "game-pitching_fall_2026")).map(row => ({ label: row.label, group: "Pitching", row })),
    ...rowsOf(section(report, "pitch-grades")).filter(r => r.percentile !== null).map(row => ({ label: row.label, group: "Pitch+", row })),
    ...testing.map(row => ({ label: row.label, group: pitchSourceLabel(row.source), row })),
    ...rowsOf(section(report, "physicality")).filter(r => r.metricKey?.startsWith("grip")).map(row => ({ label: row.label, group: "Strength", row })),
  ].filter(item => item.row.percentile !== null && !(item.row.metricKey && (BODY.has(item.row.metricKey) || COUNTS.has(item.row.metricKey))))
    .map((item, i) => ({ item, i })).sort((a, b) => rankIndex(a.item.row.metricKey) - rankIndex(b.item.row.metricKey) || a.i - b.i).map(({ item }) => item).slice(0, 14);
  const hittingWeeks = rowsOf(section(report, "weeks-qpa_fall_2026")), pitchingWeeks = rowsOf(section(report, "weeks-pitching_fall_2026"));
  const hitting = rowsOf(section(report, "game-qpa_fall_2026")), pitching = rowsOf(section(report, "game-pitching_fall_2026"));
  const grades = rowsOf(section(report, "pitch-grades")), graded = grades.filter(g => Number.isFinite(Number.parseFloat(g.value)));
  const arsenal = report.sections.filter(s => s.id.startsWith("arsenal-summary-"));
  const allowed = rowsOf(section(report, "contact-allowed"));
  const physical = rowsOf(section(report, "physicality"));
  const runTests = rowsOf(section(report, "testing"));
  const swing = [...rowsOf(section(report, "hitting-in_game")), ...rowsOf(section(report, "blast-fall"))];
  const showPitching = pitching.length > 0 || grades.length > 0 || arsenal.length > 0;
  const showHitting = hitting.length > 0 || swing.length > 0;

  return <div className={styles.sheet} data-testid="exit-meeting-handout">
    {/* FRONT */}
    <article className={styles.page} aria-label="Front"><div className={styles.pageBody} data-page-body>
      <header className={styles.hero}>
        <div className={styles.heroBrand}><PacificLogo className={styles.logo} decorative/><span>Pacific Baseball · Fall 2026 Exit Meeting</span><time dateTime={meetingDate}>{day(meetingDate)}</time></div>
        <div className={styles.heroMain}>
          <PlayerAvatar name={report.name} path={headshot} size={104} eager className={styles.photo}/>
          <div className={styles.identity}><h1>{report.name}</h1><p>{[report.jersey, report.position, report.academicClass, report.batsThrows].filter(Boolean).join(" · ")}</p>
            <p className={styles.heroFacts}>{report.lastTested && <span>Last tested {day(report.lastTested)}</span>}{report.lastGameUpdate && <span>Game stats through {day(report.lastGameUpdate.slice(0, 10))}</span>}</p></div>
          {report.jersey && <span className={styles.watermark} aria-hidden="true">{report.jersey.replace("#", "")}</span>}
        </div>
      </header>
      {tiles.length > 0 && <div className={styles.tiles} data-count={tiles.length}>{tiles.map(row => <Tile key={row.label} row={row}/>)}</div>}
      <Panel title="Where You Rank on the Team" kicker="Team percentile · 50 = middle of the team" className={styles.rankPanel}>
        <PercentileBars rows={ranked}/>
        <p className={styles.legend}><span className={styles.legendScale}/>Blue = lower on the team · Red = higher. Only stats with five or more comparable teammates are ranked.</p>
      </Panel>
      <div className={styles.insights}>
        <Insights title="Strengths" tone="strong" items={report.strengths} empty="More comparable results are needed to name a top-quarter strength."/>
        <Insights title="Focus Areas" tone="focus" items={report.development} empty="No directional stat is in the bottom team quarter."/>
        <Insights title="Biggest Jumps" tone="progress" items={report.jumps} empty="Another test date will show progress."/>
      </div>
      </div><footer className={styles.pageFoot}><span>Front · {report.name}</span><span>PACU Baseball Performance · An independent project, not an official university application</span></footer>
    </article>

    {/* BACK */}
    <article className={styles.page} aria-label="Back"><div className={styles.pageBody} data-page-body>
      <div className={styles.backHead}><PacificLogo className={styles.logoSmall} decorative/><h2>{report.name}</h2><span>Fall 2026 · Back</span></div>
      <div className={styles.columns}>
        {showHitting && <Panel title="Hitting" kicker="Fall game sheet · week trends">
          <StatTable rows={hitting.filter(r => ["batting_production_plus", "batting_ops", "batting_obp", "batting_avg", "qpa_pct", "batting_k_pct", "batting_bb_pct", "batting_est_slg"].includes(r.metricKey ?? "")).slice(0, 6)} weeks={hittingWeeks} empty="No hitting game stats yet."/>
          {swing.length > 0 && <><h4>Swing &amp; Contact</h4><ValueGrid rows={swing.slice(0, 6)}/></>}
        </Panel>}
        {showPitching && <Panel title="Pitching" kicker="Fall game sheet · Pitch+ · arsenal">
          <StatTable rows={pitching.filter(r => ["pitching_whip", "pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_r9", "strike_pct"].includes(r.metricKey ?? "")).slice(0, 6)} weeks={pitchingWeeks} empty="No pitching game stats yet."/>
          {graded.length > 0 && <><h4>Pitch+ (Team) <small>100 = Pacific average</small></h4><ul className={styles.grades}>{graded.map(g => { const score = Number.parseFloat(g.value); return <li key={g.label} data-band={Number.isFinite(score) ? score >= 110 ? "high" : score <= 90 ? "low" : "mid" : "none"}><b>{g.label.replace(" · Pitch+", "")}</b><strong>{g.value}</strong><small>{g.basis}</small></li>; })}</ul></>}
          {grades.length > 0 && !graded.length && <p className={styles.empty}>Pitch+ needs more in-game pitches and balls in play before a grade shows.</p>}
          {arsenal.map(s => <div key={s.id}><h4>{s.title}</h4><Arsenal rows={s.rows}/></div>)}
          {allowed.length > 0 && <><h4>Contact Allowed</h4><ValueGrid rows={allowed.slice(0, 3)}/></>}
        </Panel>}
        <Panel title="Physicality & Testing" kicker="Latest recorded results">
          {physical.length > 0 ? <ValueGrid rows={physical}/> : <p className={styles.empty}>No body or strength results yet.</p>}
          {runTests.length > 0 && <><h4>Speed &amp; Throwing</h4><ValueGrid rows={runTests}/></>}
        </Panel>
      </div>
      {/* Two-way sheets already show a By Week trend column in both tables, so the larger panel is skipped to fit one page. */}
      {(hittingWeeks.length > 0 || pitchingWeeks.length > 0) && !(showHitting && showPitching) && <Panel title="Fall Week by Week" kicker="Each week's own counts · same definitions as the Fall totals">
        <div className={styles.weekGrid}>{[...hittingWeeks.map(row => ({ row, group: "Hitting" })), ...pitchingWeeks.map(row => ({ row, group: "Pitching" }))].map(({ row, group }) => <div key={`${group}-${row.label}`} className={styles.weekCard}>
          <span className={styles.weekLabel}>{row.label}<small>{group}</small></span>
          <strong>{row.value}<small> latest week</small></strong>
          {row.trend && row.trend.length >= 2 ? <Sparkline points={row.trend} width={150} height={26} label={`${row.label} by week`} noun="weeks" direction={row.metricKey && LOWER_BETTER.has(row.metricKey) ? "lower" : "higher"}/> : <small className={styles.muted}>One week so far</small>}
          <small className={styles.weekBasis}>{row.basis}</small>
        </div>)}</div>
      </Panel>}
      <div className={styles.meeting}>
        <section className={styles.notes}><h3>Coach Talking Points</h3>{talkingPoints.trim() ? <p>{talkingPoints}</p> : <div className={styles.lines} aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <span key={i}/>)}</div>}</section>
        <section className={styles.goals}><h3>Winter Focus</h3><ol>{Array.from({ length: 3 }, (_, i) => <li key={i}><span/></li>)}</ol><div className={styles.sign}><span>Player</span><span>Coach</span></div></section>
      </div>
      {report.missing.length > 0 && <p className={styles.missing}>Still to add: {report.missing.join(" · ")}</p>}
      <p className={styles.method}>Percentiles compare at least five eligible teammates on the same stat, source, unit and period; body measurements are positions, not grades. Hitting doubles/triples count as doubles; PAC Production+ is a custom team index (100 = team). Pitch+ is a Pacific outcome grade, not Stuff+. Week trends use each week&apos;s own counts. Missing results stay blank.</p>
      </div><footer className={styles.pageFoot}><span>Back · Generated {day(report.generatedAt.slice(0, 10))}</span><span>Private · Coaches and the player only</span></footer>
    </article>
  </div>;
}
