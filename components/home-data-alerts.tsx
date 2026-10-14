import Link from "next/link";
import { fallBallWeekDate } from "@/lib/game-weeks";

/** Staff Home reminder when a played Fall Ball week has no in-game Full Swing session imported. */
export async function HomeDataAlerts({ missing }: { missing: Promise<{ week: number; date: string }[] | null> }) {
  const weeks = await missing;
  if (!weeks?.length) return null;
  const names = weeks.map(w => `Week ${w.week} (${fallBallWeekDate(w.week) ?? w.date})`).join(", ");
  return <p role="status" className="notice text-sm" data-testid="missing-full-swing-weeks">
    <strong>No in-game Full Swing session for {names}.</strong> Hitting, Pitching, Squared Up and Pitch+ don&apos;t include {weeks.length === 1 ? "that week" : "those weeks"} yet. If the games were tracked, <Link prefetch={false} href="/imports">import the Full Swing export</Link>.
  </p>;
}
