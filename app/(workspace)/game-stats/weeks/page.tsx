import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadFallBallWeeks } from "@/lib/fall-ball-weeks-server";
import { fallBallWeekDate } from "@/lib/game-weeks";
import { saveFallBallWeek } from "./actions";

export const metadata = { title: "Fall Ball Weeks" };
const messages: Record<string, string> = { invalid: "Choose a week and a valid date.", order: "Week dates must increase with the week number.", range: "Dates must fall between September 1 and December 31, 2026.", save: "The date could not be saved. Refresh and try again." };

/** Staff enter each BDL game-week date; Players of the Week, Week by Week and change badges follow it. */
export default async function FallBallWeeksPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const access = await requireAccess(["admin", "coach"]);
  if (!canImportPresentedAccess(access)) redirect("/game-stats");
  const [dates, params] = await Promise.all([loadFallBallWeeks(access), searchParams]);
  const known = Object.keys(dates).map(Number);
  const rows = Array.from({ length: Math.min(12, Math.max(...known, 0) + 1) }, (_, i) => i + 1);
  return <><PageHeading section="Team" title="Fall Ball Weeks" description="Enter the BDL game date for each Fall Ball week."><Link href="/game-stats" className="btn btn-secondary">Team Game Stats</Link></PageHeading>
    {params.error && messages[params.error] && <p role="alert" className="notice notice-error mb-4 text-sm">{messages[params.error]}</p>}
    {params.saved && <p role="status" className="notice mb-4 text-sm">Week {params.saved} saved.</p>}
    <section className="panel p-4 sm:p-5" aria-label="Fall Ball week dates" data-testid="fall-ball-weeks">
      <div className="table-wrap"><table><thead><tr><th>Week</th><th>BDL game date</th><th>Shown as</th><th aria-label="Save"/></tr></thead>
        <tbody>{rows.map(week => <tr key={week} data-week={week}><th scope="row">Week {week}</th>
          <td><form id={`week-${week}`} action={saveFallBallWeek}><input type="hidden" name="week" value={week}/><input type="date" name="played_on" defaultValue={dates[week] ?? ""} min="2026-09-01" max="2026-12-31" aria-label={`Week ${week} game date`}/></form></td>
          <td className="muted text-sm">{dates[week] ? fallBallWeekDate(week) : "Not set"}</td>
          <td><button form={`week-${week}`} className="btn btn-secondary">Save</button></td></tr>)}</tbody></table></div>
      <p className="muted mb-0 mt-3 text-xs">Week dates name Players of the Week, the Week by Week columns and the &ldquo;vs Week N&rdquo; change badges, and they set the qualified minimums (2 PA or 1 IP per week so far). Clear a date and save to remove that week. Sheet updates can be saved days after the games; the game date is what counts.</p>
    </section></>;
}
