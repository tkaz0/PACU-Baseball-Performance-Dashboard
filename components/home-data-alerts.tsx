import { fallBallWeekDates } from "@/lib/game-weeks";
import { FallWeekStrip } from "@/components/fall-week-strip";

/**
 * Home data health: one row per source for each confirmed Fall Ball week (everyone sees the game
 * sheets; staff also see Full Swing, where `missing` is non-null).
 */
export async function HomeDataAlerts({ missing, hittingUpdatedAt = null, pitchingUpdatedAt = null }: { missing: Promise<{ week: number; date: string }[] | null>; hittingUpdatedAt?: string | null; pitchingUpdatedAt?: string | null }) {
  const weeks = await missing;
  return <FallWeekStrip weekDates={fallBallWeekDates()} hittingUpdatedAt={hittingUpdatedAt} pitchingUpdatedAt={pitchingUpdatedAt} fullSwingMissing={weeks ? weeks.map(w => w.week) : null}/>;
}
