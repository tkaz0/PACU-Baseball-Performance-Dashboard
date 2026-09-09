# Physicality composite score

## Physicality Score (v1)

The signed-in Physicality leaderboard and hosted player Overview/Physicality tabs share one derived score: the equal-weight mean of height (higher), total muscle mass (higher), and body-fat percentage (lower) team percentiles. Require all three latest readings on the same test date, source and Fall 2026 period, within separate height/muscle unit partitions. Use the complete-player intersection as the common cohort, at least five players. Midrank percentile is `100 * (below + (ties - 1)/2) / (n - 1)`; body-fat order is reversed. Round the average to one decimal before competition ranking. Ties share rank; no missing-value imputation or partial score.

Choose the comparison with the most complete players, then source, height unit and muscle unit names for deterministic ties. Earlier-period results are not substituted. The source, cohort size, test date and method are shown; the three component percentiles appear on profiles. Score is a descriptive team index, not a health target or validated performance predictor. Weight, grip and speed do not enter v1. Cohort changes can alter scores without a new test.

No migration, stored score or expanded RLS. Use ordinary-session existing team leaderboard RPCs, preserving their eligible cohort and presented-role profile-link restrictions. Player pages receive only their own derived score, not peer history. The browser-local review workspace does not compute a separate score.
