import Link from "next/link";
import { fallBallWeekDate, fallBallWeekDates } from "@/lib/game-weeks";
import { DataFreshness } from "@/components/data-freshness";
import { weeksAfterUpdate } from "@/lib/data-freshness";
import { pacificTestingDate } from "@/lib/testing-checklist";

/**
 * Home reminders: a played Fall Ball week has not reached a game sheet yet (everyone), or has no
 * in-game Full Swing session imported (staff only; `missing` is null for players).
 */
export async function HomeDataAlerts({ missing, hittingUpdatedAt = null, pitchingUpdatedAt = null }: { missing: Promise<{ week: number; date: string }[] | null>; hittingUpdatedAt?: string | null; pitchingUpdatedAt?: string | null }) {
  const weeks = await missing;
  const today = pacificTestingDate();
  const names = weeks?.map(w => `Week ${w.week} (${fallBallWeekDate(w.week) ?? w.date})`).join(", ");
  return <>
    <DataFreshness source="the hitting sheet" weeks={weeksAfterUpdate(hittingUpdatedAt, fallBallWeekDates(), today)} updatedAt={hittingUpdatedAt}>Hitting stats and Hitter of the Week will update when it changes.</DataFreshness>
    <DataFreshness source="the pitching sheet" weeks={weeksAfterUpdate(pitchingUpdatedAt, fallBallWeekDates(), today)} updatedAt={pitchingUpdatedAt}>Pitching stats and Pitcher of the Week will update when it changes.</DataFreshness>
    {!!weeks?.length && <p role="status" className="notice text-sm" data-testid="missing-full-swing-weeks">
      <strong>No in-game Full Swing session for {names}.</strong> Hitting, Pitching, Squared Up and Pitch+ don&apos;t include {weeks.length === 1 ? "that week" : "those weeks"} yet. If the games were tracked, <Link prefetch={false} href="/imports">import the Full Swing export</Link>.
    </p>}
  </>;
}
