/**
 * Owner request (November 2): Fall 2026 is complete (Fall Ball Weeks 1–4 plus the Boxer World Series). Visible
 * "Fall to date" labels read as final, team change badges compare with Week 1, and Home shows a season wrap-up.
 * Presentation only: no data, calculation, qualification or access changes. Set to false to restore live wording.
 */
export const FALL_2026_FINAL = true;
export const FALL_SPAN_LABEL = FALL_2026_FINAL ? "Fall 2026 Final" : "Fall to Date";
/** Qualified minimums are per confirmed Fall Ball week; once the season is final that count no longer grows. */
export const PER_WEEK_PHRASE = FALL_2026_FINAL ? "per Fall Ball week" : "per Fall Ball week so far";
