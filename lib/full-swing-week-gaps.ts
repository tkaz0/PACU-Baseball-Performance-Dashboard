/**
 * Fall Ball game weeks (confirmed dates on or before today) that have no in-game Full Swing
 * session saved near the game date. Exports are sometimes dated a day or two before the
 * confirmed week date (for example a Friday intrasquad for a Saturday week), so a session from
 * three days before through one day after the week date counts.
 */
export function missingFullSwingWeeks(weekDates: Readonly<Record<number, string>>, sessionDates: readonly string[], today: string): { week: number; date: string }[] {
  const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  return Object.entries(weekDates).map(([week, date]) => ({ week: Number(week), date }))
    .filter(w => w.date <= today && !sessionDates.some(s => day(s) >= day(w.date) - 3 && day(s) <= day(w.date) + 1))
    .sort((a, b) => a.week - b.week);
}
