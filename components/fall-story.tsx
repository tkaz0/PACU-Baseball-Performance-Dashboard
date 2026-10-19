import { fallStory } from "@/lib/fall-story";
import type { Measurement } from "@/lib/imports/engine";
import { profileMetricLabel } from "@/lib/profile-metric-label";
import { formatSourceNumber } from "@/lib/measurement-display";
import { pitchSourceLabel } from "@/lib/pitch-display";
import styles from "./fall-story.module.css";

const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const t = (date: string) => Date.parse(`${date}T12:00:00Z`);
const CATEGORY_CLASS: Record<string, string> = { "Physicality": "body", "In-Game": "game", "Practice": "practice" };

/** Horizontal Fall timeline: test days, game weeks and where each Fall best happened. Descriptive only. */
export function FallStory({ readings, weekDates, today, maxPins = 6 }: { readings: readonly Measurement[]; weekDates: Readonly<Record<number, string>>; today: string; maxPins?: number }) {
  const { sessions, bests, weeks } = fallStory(readings, weekDates, today);
  if (!sessions.length && !weeks.length) return null;
  const start = "2026-09-01", end = today < "2026-12-31" ? today : "2026-12-31";
  const span = Math.max(1, t(end) - t(start)), pos = (date: string) => `${Math.max(0, Math.min(100, (t(date) - t(start)) / span * 100))}%`;
  const days = [...new Map(sessions.map(s => [`${s.date}|${s.category}`, s])).values()];
  const pins = bests.slice(0, maxPins);
  const months = ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"].filter(m => m <= end);
  return <section className={styles.story} aria-label="Fall story" data-testid="fall-story">
    <header><h2>Fall Story</h2><p>{days.length} test {days.length === 1 ? "day" : "days"} · {weeks.length} game {weeks.length === 1 ? "week" : "weeks"} · {bests.length} Fall {bests.length === 1 ? "best" : "bests"}</p></header>
    <div className={styles.track} role="img" aria-label={`Fall timeline from ${short(start)} to ${short(end)}`}>
      <span className={styles.rail} />
      {months.map(m => <span key={m} className={styles.month} style={{ left: pos(m) }}>{new Date(`${m}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>)}
      {weeks.map(w => <span key={w.week} className={styles.week} style={{ left: pos(w.date) }} title={`Fall Ball Week ${w.week} · ${short(w.date)}`}>Wk {w.week}</span>)}
      {days.map(d => <span key={`${d.date}|${d.category}`} className={`${styles.day} ${styles[CATEGORY_CLASS[d.category] ?? "testing"]}`} style={{ left: pos(d.date) }} title={`${short(d.date)} · ${d.category}`} />)}
      {pins.map(p => <span key={p.key} className={styles.pinMark} style={{ left: pos(p.date) }} title={`Fall best · ${short(p.date)}`}>★</span>)}
      <span className={styles.today} style={{ left: pos(end) }}>Today</span>
    </div>
    <div className={styles.legend}><span><i className={styles.body} />Body</span><span><i className={styles.testing} />Testing</span><span><i className={styles.practice} />Practice</span><span><i className={styles.game} />In-game</span><span><b>Wk</b> game week</span><span>★ Fall best</span></div>
    {pins.length > 0 && <ul className={styles.pins}>{pins.map(p => <li key={p.key}><span className={styles.star}>★</span><span><strong>{profileMetricLabel(p.metric, p.label, p.source)}</strong> {formatSourceNumber(p.value, p.source)} {p.unit}<small>{short(p.date)} · {pitchSourceLabel(p.source)}</small></span></li>)}</ul>}
    {bests.length > pins.length && <p className={styles.more}>+{bests.length - pins.length} more Fall bests in the cards below.</p>}
  </section>;
}
