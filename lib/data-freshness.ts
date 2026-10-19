import { pacificTestingDate } from "@/lib/testing-checklist";

export type MissingWeek = { week: number; date: string };
/**
 * Confirmed Fall Ball weeks (played on or before today) that come after the source's last saved change.
 * Game sheets are cumulative and only save a new version when numbers change, so a week dated after the
 * last change has not reached the dashboard yet. A missing update date reports nothing.
 */
export function weeksAfterUpdate(updatedAt: string | null | undefined, weekDates: Readonly<Record<number, string>>, today: string): MissingWeek[] {
  if (!updatedAt) return [];
  const time = new Date(updatedAt);
  if (!Number.isFinite(time.getTime())) return [];
  const changed = /^\d{4}-\d{2}-\d{2}$/.test(updatedAt) ? updatedAt : pacificTestingDate(time);
  return Object.entries(weekDates).map(([week, date]) => ({ week: Number(week), date }))
    .filter(w => Number.isSafeInteger(w.week) && w.date <= today && w.date > changed)
    .sort((a, b) => a.week - b.week);
}

/** "Week 4 (Oct 16)" or "Weeks 3–4 (Oct 10, Oct 16)". */
export function missingWeeksLabel(weeks: readonly MissingWeek[]): string {
  const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (!weeks.length) return "";
  if (weeks.length === 1) return `Week ${weeks[0].week} (${short(weeks[0].date)})`;
  const consecutive = weeks.every((w, i) => i === 0 || w.week === weeks[i - 1].week + 1);
  const names = consecutive ? `Weeks ${weeks[0].week}–${weeks.at(-1)!.week}` : `Weeks ${weeks.map(w => w.week).join(", ")}`;
  return `${names} (${weeks.map(w => short(w.date)).join(", ")})`;
}
