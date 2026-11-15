# Spring 2027 changeover plan

Status: inventory and plan (November 14, 2026). Nothing here has been changed yet. Fall 2026 must stay viewable exactly as it finished.

## What stays the same

- **Roster season.** Spring 2027 is still the `2026-27` academic season, so `athlete_seasons`, eligibility (null/active/redshirt), PAC codes, accounts and RLS carry over unchanged.
- **Source data.** Saved Fall observations, snapshots, contacts, hashes and receipts are never rewritten; the spring work adds new periods and sources beside them.

## What blocks spring data today

The database and app assume one Fall window (2026-09-01 to 2026-12-31) and two Fall game sources. Spring readings would be rejected or silently left out:

| Area | Where | Effect on spring data |
|---|---|---|
| Period mapping | `case when measured_at between '2026-09-01' and '2026-12-31' then 'fall_2026'` in the leaderboard, sample-count and Fall-best/rollup functions (about 15 migrations) | Spring measurements get no period, so they never reach leaderboards, percentiles or Fall-style rollups |
| Game sources | `check (source in ('qpa_fall_2026','pitching_fall_2026'))` on `game_stat_snapshots` / `game_sync_state` and the import RPCs | A spring game sheet can't be saved at all |
| Game metric lists | rank/leaderboard functions filter `source='qpa_fall_2026'` / `'pitching_fall_2026'` | Spring game stats wouldn't rank |
| Date checks | `full_swing_contacts.played_on`, Full Swing publications, dated game logs, movement screenings, player-goal baselines: `between '2026-09-01' and '2026-12-31'` | Spring Full Swing contacts and logs are rejected |
| App periods | `PlayerPerformancePeriod` (`fall_2026` / `summer_2026`), profile/leaderboard period choice, "Fall best", week logic (`fall-2026-week-N`, `BWS_START`, `fallBallWeekDates`) | Profiles and boards only know Fall |
| Labels | "Fall 2026", "Fall to Date", `FALL_2026_FINAL` (about 65 app files) | Wording |
| Benchmarks | Report Card and stat bands use NWC full-season distributions | Fine for spring; label check only |
| Sync | Codex Monday automation (paused) reads only the two Fall tabs | Needs the spring tab IDs and a reviewed layout |

## Plan (in order)

1. **Get the spring sources.** Spring QPA and pitching sheet tabs (IDs, layout, per-game or cumulative), and whether Full Swing/Blast/RENPHO exports keep their Fall formats. Per-game rows would allow real game logs and dates instead of week differencing.
2. **Season registry (app).** One `lib/seasons.ts` listing periods (`summer_2026`, `fall_2026`, `spring_2027`) with dates, labels and game sources, plus a "current period" setting. Replace hard-coded Fall dates and labels with lookups. `FALL_2026_FINAL` becomes "is this period final".
3. **Database migration (additive).** A `private.performance_period(date)` function returning the period for a date; replace the hard-coded `case` in every ranking/rollup function with it; widen date checks to the 2026-27 season (2026-06-01 to 2027-06-30); add `qpa_spring_2027` / `pitching_spring_2027` to the source checks and metric lists. Deploy the compatible app first, as with every earlier read-time migration.
4. **Season picker.** Profiles, leaderboards, Records, Team Game Stats and Analytics get a Fall 2026 / Spring 2027 picker defaulting to the current period. Fall stays the final Fall view.
5. **Spring game import.** Reviewed layout capture for the new tabs (same full-grid guard, identity review and last-good-snapshot rules), then turn the sync back on for spring only.
6. **Checks.** Fall values identical before and after (compare leaderboards, profiles and a few handouts), then spring import dry run on a copy of the sheet.

Estimated size: steps 2–4 touch roughly 90 app files and 15–20 SQL functions; best done in early January before spring games.
