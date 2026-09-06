# Player performance profiles

This change adds shared private measurements, profile cards/history, and team comparisons. Missing data stays missing. The dashboard does not manufacture measurements or infer game results from empty sheets.

## Periods and latest readings

- **Fall 2026:** September 1–December 31, inclusive, for body, hitting, field-throwing and pitching metrics.
- **Earlier body testing:** June 1–August 31, inclusive, for body metrics only. It remains separate from Fall; baseball summer statistics are excluded.

Profiles display **Last Tested** with the actual latest date and show the requested **Athlete ID**. They do not use summer-baseline labels or duplicate older readings in the snapshot; older observations remain in measurement history.

These are calendar windows, not a claim that every date has occurred or has measurements. Each reading keeps its actual test date. Latest selection uses date descending, import time descending at millisecond precision, then file hash and observation ID ascending. History uses the reverse order. Different units and source protocols are not converted or pooled.

Shared measurement pages and comparison summaries both retain round-trip floating-point precision in JSON, including values with more than 15 significant digits. A summary attaches only to the exact athlete, metric, date, value, unit, source and period shown on the profile; raw values and derived percentages are not rounded for matching. Display rounding does not change the underlying measurements or cohort counts.

## Profile tabs

**Overview** opens first with relative team Strengths, Weaknesses and Biggest Jumps when reviewed tests support them. **Physicality** follows: Weight, Height, Grip Strength and Body Fat % are the main values. Muscle Mass %, recorded speed/agility tests and full RENPHO charts follow below. **Hitting** leads with Max EV, Average EV, Max Bat Speed, Average Bat Speed, Smash Factor and Max Distance; it is hidden for pitcher-only profiles and retained for explicitly two-way players. **Throwing** uses explicit primary/secondary positions to show infield or outfield velocity, plus pitching metrics for pitchers and two-way players. An unknown position does not invent a throwing discipline. Game stats live in their separate team section and are not duplicated in player profile tabs. Longer measurement history remains optional.

The main display emphasizes the measured value, original unit and **Last Tested** date. Repeated import/provenance and unavailable-percentile messages are removed from the main canvas; optional source/method details remain inspectable. Status is hidden from the staff roster table without changing stored status or comparison eligibility. Staff name searches suggest matching current players as they type; Player views receive no staff directory search.

## Overview insight method

The Overview uses only the permitted, role-relevant metric cards already supplied to that profile. It does not fetch other players' observations, invent training advice or turn game-sheet totals into testing measurements.

- **Strengths:** up to three directional metrics at or above the 75th favorable team percentile, highest percentile first.
- **Weaknesses:** up to three directional metrics at or below the 25th favorable team percentile, lowest percentile first. These describe the player's position among the comparable measured teammates, not an absolute assessment of ability.
- **Biggest Jumps:** up to three favorable changes from the most recent earlier, distinct testing date for the same athlete, metric, source/protocol, unit and comparison period. They are ordered by relative improvement: favorable change divided by the earlier value, multiplied by 100. Raw before/after values and dates remain available; changes to percentage metrics use percentage points (`pp`). This ordering describes proportional changes and does not imply that unlike tests have equal athletic importance.

Strengths and Weaknesses require an available exact-cohort percentile with at least five comparable athletes, using the existing percentile method below. Height, weight, body fat, muscle mass percentage and fastball spin remain neutral numerical measurements; they never become Strengths, Weaknesses or Biggest Jumps. Directional grip strength, speed/agility, hitting and throwing tests can qualify when included in the profile's role layout. Results in the middle half of the team remain unclassified. The model also returns the number of metrics with valid team comparisons, so the empty state can distinguish insufficient team testing from no qualifying strengths or weaknesses.

Biggest Jumps describe personal change and do not require a team cohort. Higher-is-better metrics must increase; lower-is-better times and walk percentage must decrease. An unchanged or unfavorable latest result is not a jump. The earlier value must be finite and strictly positive; a zero or decline is never skipped in favor of an older favorable comparison. Same-date reimports are not improvements: the existing latest selection and date/import-time/file-hash/observation-ID tie-breaks determine the one reading used for each date. Different testing periods, sources and units never mix, even when values could be converted. Equal insight scores use the canonical metric order, and an insight appears only once per metric.

When these conditions are not met, the corresponding list stays empty. One body-composition report alone cannot establish a player's athletic strengths, weaknesses or progress.

## Profile metrics

| Group | Metric | Definition / input | Units | Comparison direction |
| --- | --- | --- | --- | --- |
| Body | Height | Reviewed measured height | in, cm | Neutral |
| Body | Weight | Reviewed body weight | lb, kg, st | Neutral |
| Body | Grip strength | Explicitly reviewed dynamometer value and protocol | lb, kg, N | Higher |
| Body | Body fat % | Reported body-fat percentage | % | Neutral |
| Body | Muscle mass % | Reported percentage, or the supported same-report calculation below | % | Neutral |
| Hitting | Max EV | Source's reviewed maximum exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Average EV | Source's reviewed mean exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Bat speed | Legacy generic source reading; never relabeled as a maximum or average | mph, km/h, m/s | Higher |
| Hitting | Max / Average bat speed | Separately reviewed session summaries | mph, km/h, m/s | Higher |
| Hitting | Smash factor | Explicit source-reported ratio; no calculation from unrelated averages | ratio | Higher |
| Hitting | Max distance | Reviewed session maximum hit distance | ft, m | Higher |
| Hitting | Home to 1st / Home to 2nd | Elapsed times under the named testing protocol | s | Lower |
| Hitting | Steal break / Boxer T | Elapsed times under the named testing protocol | s | Lower |
| Field throwing | Infield / Outfield velocity | Separate reviewed throwing protocols; never substituted for pitch velocity | mph, km/h, m/s | Higher |
| Pitching | Average velocity | Reviewed mean pitch velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Pitching | Max velocity | Source's reviewed maximum pitch velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Pitching | Average fastball spin | Source's reviewed mean fastball spin for its stated sample | rpm | Neutral |
| Pitching | Strike % | Strikes ÷ pitches × 100 | % | Higher |
| Pitching | K % | Strikeouts ÷ batters faced × 100 | % | Higher |
| Pitching | BB % | Walks ÷ batters faced × 100 | % | Lower |

Max/average labels describe approved source summaries; the importer does not calculate them from arbitrary event rows or average precomputed percentages. Strike/K/BB denominators must be verified by the source adapter. Percentage inputs are percentage points: `50` means 50%, while `0.5` means 0.5%; no automatic fraction scaling occurs. Height, weight and elapsed times must be positive; other readings must be finite and nonnegative, and percentages must be 0–100. No athletic or medical reference ceilings are invented.

**Pitching-sheet naming exception:** the existing Pitching Stats `FALL` sheet labels strikes/pitches as **K%**. The game adapter maps verified strikes/pitches to `strike_pct`. PACU's profile **K %** means strikeouts/batters faced and must come from verified strikeout and batters-faced counts. A generic header match must not reinterpret the source column. The selected QPA source remains only `2026 - Fall`; its cumulative snapshots and recorded pitching events appear in the separate [game-stat workflow](GAME_STATS.md), not as daily physical/testing observations.

## Percentile bars

The explicit cohort is athletes with an `athlete_seasons` row for `2026-27` and status null, active or redshirt. Inactive, alumni and other-season entries are excluded. A player type is not required when a comparable metric exists.

Use one latest observation per measured cohort athlete for the exact metric, unit, period and source/protocol. Source comparison trims/collapses whitespace and ignores case; distinct protocols must have distinct source labels. Body June–August and September–December observations never share a cohort calculation. The target athlete must belong to the cohort. A percentile appears only when at least **five** comparable athletes are measured; otherwise no percentile bar is shown. The method detail explains the minimum without repeating it on each card.

For `n` comparable athletes, ascending tied rank is `100 × (below + (equal − 1) / 2) / (n − 1)`, including the target. Lower-direction metrics invert this value. Neutral body metrics and fastball spin show numerical position only: a larger percentile is not a health target, a better body composition or inherently better pitching.

The private summary RPC accepts only the authorized athlete UUID. Its periods, metrics and cohort are fixed. For this profile RPC, Players receive their own values and aggregate comparison results, never raw peer measurements; they cannot supply thresholds to probe peers. Admin View as also restricts the returned athlete before invoking the RPC.

## Team leaderboards

The owner separately authorized **all active signed-in players and staff** to see team leaderboard values, including physicality. The dedicated leaderboard RPC exposes a minimal latest-result projection and does not expand normal peer profile/history/contact access. Leaders use one latest comparable reading per eligible athlete, exact metric/unit/source/period choices, tied places and actual measurement dates. Neutral body/spin tables show numerical comparisons without a good/bad score. A leaderboard can show recorded results before five players have tested; the five-player minimum still applies to percentile bars. See [LEADERBOARDS](LEADERBOARDS.md).

## RENPHO details and derived muscle percentage

The existing supported raw RENPHO readings remain available for report bars, indicators and history, including mass values, BMI, BMR, visceral fat, SMI, metabolic age and waist-to-hip ratio. They do not all become main profile cards or receive percentiles.

Muscle mass percentage may be calculated as `muscle mass / weight × 100` only from exactly one valid weight and one valid muscle-mass reading belonging to the same athlete, file hash and date, with canonical RENPHO report-page provenance and matching lb or kg units. Muscle mass must not exceed weight. A reported muscle percentage in that report takes precedence; ambiguous pairs produce no derived reading. This calculation is labeled and retains both source readings. It does not write a synthetic observation to the database or substitute skeletal muscle mass.

## From browser review to shared profiles

The main **Information Imports** hub at `/imports` accepts supported RENPHO reports and explicitly mapped summary CSVs, uses the live roster, and saves reviewed readings directly to profiles. Admins and Coaches can use it outside private View as. See [INFORMATION_IMPORTS](INFORMATION_IMPORTS.md).

Existing browser backups can still be shared separately:

1. An active Admin outside private View as reviews the original report locally, approves its athlete/date/values/units, and exports a private browser-workspace backup. Backup export remains Admin-only.
2. As an active Admin or Coach outside preview, open **Shared measurements** (`/admin/performance`) and choose the reviewed backup. The file is parsed on the device; the UI accepts up to 2 MiB.
3. Inspect exact shared-athlete matches, supported readings and explicitly listed unsupported metrics. Invalid recognized metrics/units/values/provenance block sharing. A reviewed transaction supports 1–500 observations. Both the posted Measurement JSON and normalized database JSON must fit within 1 MiB.
4. Approve **Share with team**. Only the eleven whitelisted Measurement fields are serialized; images, OCR/report text, unknown backup properties, local report IDs and the full backup are excluded.
5. The server rechecks active Admin/Coach access and input, then imports through the ordinary user's session. SQL matches permanent athlete codes, checks canonical metrics/units and dates, preserves source observation IDs, and saves the batch atomically. Identical repeats are unchanged; conflicting observations reject the whole transaction. A renamed-file retry preserves the original filename and import provenance.

Private players read only their linked profile; coaches/admins can read the team. Shared observations are immutable through normal app writes. Clearing a browser workspace does not remove shared data, and restoring a browser backup does not automatically publish it.

## Account preparation is separate

**Team account preparation** (`/admin/rollout`) displays player readiness and stores reviewed coach names/contact emails. A preparation record is not an Auth user, does not grant a Coach role, and sends no invitation. **Account connected** verifies the trusted link/status, not completed password setup. The owner has said not yet to team emails. Keep sends disabled and unsent until explicit approval through the separate Account access workflow. See [INVITATIONS](INVITATIONS.md).

## Coach presentation

Height cards and height leaderboard results display feet and inches, rounded to one tenth of an inch (for example, 71 in displays as 5′ 11″). The saved reading and unit remain unchanged in sources; calculations, ordering and comparison cohorts still use the original values and units. Missing main metrics display a dash and Not Yet Tested.
