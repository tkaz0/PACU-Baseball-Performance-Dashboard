import "server-only";
import { cache } from "react";
import type { requireAccess } from "@/lib/auth";
import { DEFAULT_FALL_BALL_WEEK_DATES, setFallBallWeekDates } from "@/lib/game-weeks";

/**
 * Applies the staff-saved Fall Ball week dates for this request. A missing table or failed read keeps
 * the confirmed defaults, so labels and qualified minimums never disappear.
 */
export const loadFallBallWeeks = cache(async (access: Pick<Awaited<ReturnType<typeof requireAccess>>, "supabase">) => {
  try {
    const { data, error } = await access.supabase.from("fall_ball_weeks").select("week,played_on").order("week");
    if (error || !Array.isArray(data) || !data.length) { setFallBallWeekDates(DEFAULT_FALL_BALL_WEEK_DATES); return DEFAULT_FALL_BALL_WEEK_DATES; }
    const dates: Record<number, string> = {};
    for (const row of data) if (Number.isSafeInteger(row.week) && typeof row.played_on === "string") dates[row.week] = row.played_on;
    setFallBallWeekDates(dates);
    return dates;
  } catch { setFallBallWeekDates(DEFAULT_FALL_BALL_WEEK_DATES); return DEFAULT_FALL_BALL_WEEK_DATES; }
});
