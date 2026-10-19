import Link from "next/link";
import { Check, Clock, Minus } from "lucide-react";
import { pacificTestingDate } from "@/lib/testing-checklist";
import styles from "./fall-week-strip.module.css";

type Status = "in" | "missing" | "upcoming" | "unknown";
const day = (stamp: string | null | undefined) => !stamp ? null : /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? stamp : Number.isFinite(Date.parse(stamp)) ? pacificTestingDate(new Date(stamp)) : null;
const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * One row per confirmed Fall Ball week showing whether each source has reached the dashboard.
 * Game sheets count a week as in once the sheet changed on or after the week date. Full Swing
 * (staff only) uses the saved in-game contact dates; `fullSwingMissing` null means not shown.
 */
export function FallWeekStrip({ weekDates, hittingUpdatedAt, pitchingUpdatedAt, fullSwingMissing }: { weekDates: Readonly<Record<number, string>>; hittingUpdatedAt: string | null; pitchingUpdatedAt: string | null; fullSwingMissing: readonly number[] | null }) {
  const today = pacificTestingDate(), weeks = Object.entries(weekDates).map(([week, date]) => ({ week: Number(week), date })).filter(w => Number.isSafeInteger(w.week)).sort((a, b) => a.week - b.week);
  if (!weeks.length) return null;
  const hit = day(hittingUpdatedAt), pitch = day(pitchingUpdatedAt);
  const sheet = (changed: string | null, date: string): Status => date > today ? "upcoming" : !changed ? "unknown" : changed >= date ? "in" : "missing";
  const sources = [
    { key: "hitting", label: "Hitting sheet", status: (date: string) => sheet(hit, date) },
    { key: "pitching", label: "Pitching sheet", status: (date: string) => sheet(pitch, date) },
    ...(fullSwingMissing ? [{ key: "fullswing", label: "Full Swing", status: (date: string, week: number): Status => date > today ? "upcoming" : fullSwingMissing.includes(week) ? "missing" : "in" }] : []),
  ];
  const missing = weeks.some(w => sources.some(s => s.status(w.date, w.week) === "missing"));
  const icon = (status: Status) => status === "in" ? <Check size={14} aria-hidden="true" /> : status === "missing" ? <Clock size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />;
  const word = { in: "In", missing: "Not in yet", upcoming: "Upcoming", unknown: "No data" } as const;
  return <section className={styles.strip} aria-label="Fall Ball data by week" data-testid="fall-week-strip">
    <header><h2>Fall Ball Weeks</h2><p>{missing ? "Clock = played but not on the dashboard yet." : "Every played week is on the dashboard."}{fullSwingMissing && missing ? <> <Link prefetch={false} href="/imports">Import results</Link></> : null}</p></header>
    <div className={styles.scroll}><table>
      <thead><tr><th scope="col"><span className="sr-only">Source</span></th>{weeks.map(w => <th key={w.week} scope="col" data-upcoming={w.date > today || undefined}>Wk {w.week}<small>{short(w.date)}</small></th>)}</tr></thead>
      <tbody>{sources.map(source => <tr key={source.key}><th scope="row">{source.label}</th>{weeks.map(w => { const status = source.status(w.date, w.week); return <td key={w.week} data-status={status} aria-label={`${source.label}, Week ${w.week}: ${word[status]}`} title={word[status]}>{icon(status)}</td>; })}</tr>)}</tbody>
    </table></div>
  </section>;
}
