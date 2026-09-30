# Training-block comparisons

The profile Timeline compares two owner-selected, chronological, nonoverlapping Fall 2026 date windows. Cards use paired bars, exact values, changes, recorded sample counts, session counts and actual result dates. Categories and exact sources stay separate. No new database tables or writes are required.

`buildTrainingBlockSeries(readings, { athleteCode, showHitting, showPitching, today?, readingCounts? })` runs after the existing own-player or staff profile authorization. It returns a numerical display projection without athlete identities, observation IDs, filenames, file hashes or source coordinates. Pass it to `<TrainingBlockComparison series={series} />`. `readingCounts` is optional, separately verified per-observation Full Swing count evidence; absence never becomes an assumed count.

`loadTrainingBlockCounts(access, athleteId)` supplies that evidence through the ordinary signed-in session. Migration `202609300004_training_block_samples.sql` adds only a narrow read RPC. It checks `private.can_read_athlete`, matches athlete/file/row/metric/unit to a unique current summary, excludes unsupported and future observations, and returns fixed 1,000-row pages. Each count includes its observation ID plus the measurement's exact value, date, source, metric key and unit. The series builder accepts it only if those fields match the separately loaded measurement; a concurrent republish cannot weight an older mean with a newer count. The application rechecks effective Player View restrictions before querying, validates exact response keys and counts, rejects duplicate IDs, and caps the result at 20,000 rows. Count evidence is consumed on the server, not included in client props. Apply the read RPC before using the new reader in production.

## Calculation rules

- Blast: only the reviewed weekly Average export and five main metrics. Each report must fit completely inside a selected window; overlapping periods, duplicate metrics, conflicting observations or missing swing counts withhold the affected average. Weight by recorded swings. Weekly P95 files cannot supply means, maximums or added samples.
- Classified Full Swing: keep each exact pitch type, unit and Game / Intrasquad / Practice source separate. Average velocity and spin have independent reading counts; best values use saved maximums. Missing counts withhold the average instead of using an unweighted mean or disguising a latest-session fallback as a block mean.
- Broad Full Swing hitter summaries: show best saved maximums; averages require separately verified per-observation samples through `readingCounts`. Missing sample counts remain visibly unavailable. No pitch classification is inferred.
- Timed Player Metrics and manual tests: fastest saved raw trial, arithmetic mean of recorded trials, trial count and distinct session count. Protocol/source/unit partitions remain separate. Hidden timing metrics and pitcher-only visibility rules stay hidden.
- RENPHO and physical testing: latest unique test in each selected block, with actual date and total recorded test coverage. Body metrics stay descriptive. Conflicting latest same-day readings are withheld.
- Cumulative QPA and pitching-sheet snapshots never enter this feature. It does not subtract snapshots to invent period results, merge devices, calculate a block P95, infer outcomes, or generate an unsupported performance score.
- Only valid Fall dates through the Pacific current day enter the projection. Default blocks prefer a gap between full reports. A window that cuts through a weekly report asks the viewer to include that report's full dates.

Color follows existing directional baseball metrics. Spin, body and angle changes remain neutral. A change shows association with the selected period; it does not assert that a drill, cue, or intervention caused the result.

Tests in `tests/training-blocks.test.ts` use fictional fixtures for weighting, exact partitions, missing counts, partial and overlapping weeks, duplicate/conflicting readings, units, role visibility, timestamps, raw timed trials and read-only projection privacy.
