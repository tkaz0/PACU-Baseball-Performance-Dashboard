# Player performance profiles

This change adds shared private measurements, profile cards/history, and team comparisons. Missing data stays missing. The dashboard does not manufacture measurements or infer game results from empty sheets.

## Periods and latest readings

- **Fall 2026:** September 1–December 31, inclusive, for body, hitting and pitching metrics.
- **Summer 2026 baseline:** June 1–August 31, inclusive, for body metrics only. It remains separate from Fall; baseball summer statistics are excluded.

These are calendar windows, not a claim that every date has occurred or has measurements. Each reading keeps its actual test date. Latest selection uses date descending, import time descending at millisecond precision, then file hash and observation ID ascending. History uses the reverse order. Different units and source protocols are not converted or pooled.

Shared comparison summaries retain round-trip floating-point precision in JSON. A summary attaches only to the exact athlete, metric, date, value, unit, source and period shown on the profile; derived percentages are not rounded for matching. Display rounding does not change the underlying measurements or cohort counts.

## Profile metrics

| Group | Metric | Definition / input | Units | Comparison direction |
| --- | --- | --- | --- | --- |
| Body | Height | Reviewed measured height | in, cm | Neutral |
| Body | Weight | Reviewed body weight | lb, kg, st | Neutral |
| Body | Body fat % | Reported body-fat percentage | % | Neutral |
| Body | Muscle mass % | Reported percentage, or the supported same-report calculation below | % | Neutral |
| Hitting | Max EV | Source's reviewed maximum exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Average EV | Source's reviewed mean exit velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Hitting | Bat speed | Reviewed source bat-speed reading | mph, km/h, m/s | Higher |
| Hitting | Home to 1st / Home to 2nd | Elapsed times under the named testing protocol | s | Lower |
| Hitting | Steal break / Boxer T | Elapsed times under the named testing protocol | s | Lower |
| Pitching | Max velocity | Source's reviewed maximum pitch velocity for its stated session/sample | mph, km/h, m/s | Higher |
| Pitching | Average fastball spin | Source's reviewed mean fastball spin for its stated sample | rpm | Neutral |
| Pitching | Strike % | Strikes ÷ pitches × 100 | % | Higher |
| Pitching | K % | Strikeouts ÷ batters faced × 100 | % | Higher |
| Pitching | BB % | Walks ÷ batters faced × 100 | % | Lower |

Max/average labels describe approved source summaries; the importer does not calculate them from arbitrary event rows or average precomputed percentages. Strike/K/BB denominators must be verified by the source adapter. Percentage inputs are percentage points: `50` means 50%, while `0.5` means 0.5%; no automatic fraction scaling occurs. Height, weight and elapsed times must be positive; other readings must be finite and nonnegative, and percentages must be 0–100. No athletic or medical reference ceilings are invented.

**Pitching-sheet naming exception:** the existing Pitching Stats `FALL` sheet labels strikes/pitches as **K%**. Its adapter must map that column to `strike_pct`. PACU's profile **K %** means strikeouts/batters faced and must come from verified strikeout and batters-faced counts. A generic header match must not reinterpret the source column. The selected QPA source remains only `2026 - Fall`; direct game-sheet synchronization is separate work.

## Percentile bars

The explicit cohort is athletes with an `athlete_seasons` row for `2026-27` and status null, active or redshirt. Inactive, alumni and other-season entries are excluded. A player type is not required when a comparable metric exists.

Use one latest observation per measured cohort athlete for the exact metric, unit, period and source/protocol. Source comparison trims/collapses whitespace and ignores case; distinct protocols must have distinct source labels. Body Summer and Fall observations never share a cohort calculation. The target athlete must belong to the cohort. A percentile appears only when at least **five** comparable athletes are measured; otherwise the sample size is shown without a rank bar.

For `n` comparable athletes, ascending tied rank is `100 × (below + (equal − 1) / 2) / (n − 1)`, including the target. Lower-direction metrics invert this value. Neutral body metrics and fastball spin show numerical position only: a larger percentile is not a health target, a better body composition or inherently better pitching.

The private summary RPC accepts only the authorized athlete UUID. Its periods, metrics and cohort are fixed. Players receive their own values and aggregate comparison results, never raw peer measurements; they cannot supply thresholds to probe peers. Admin View as also restricts the returned athlete before invoking the RPC.

## RENPHO details and derived muscle percentage

The existing supported raw RENPHO readings remain available for report bars, indicators and history, including mass values, BMI, BMR, visceral fat, SMI, metabolic age and waist-to-hip ratio. They do not all become main profile cards or receive percentiles.

Muscle mass percentage may be calculated as `muscle mass / weight × 100` only from exactly one valid weight and one valid muscle-mass reading belonging to the same athlete, file hash and date, with canonical RENPHO report-page provenance and matching lb or kg units. Muscle mass must not exceed weight. A reported muscle percentage in that report takes precedence; ambiguous pairs produce no derived reading. This calculation is labeled and retains both source readings. It does not write a synthetic observation to the database or substitute skeletal muscle mass.

## From browser review to shared profiles

1. Review the original supported report locally and approve its athlete, date, values and units. Export a private workspace backup.
2. As an active Admin outside preview, open **Shared measurements** (`/admin/performance`) and choose the backup. The file is parsed on the device; the UI accepts up to 2 MiB.
3. Inspect exact shared-athlete matches, supported readings and explicitly listed unsupported metrics. Invalid recognized metrics/units/values/provenance block sharing. A reviewed transaction supports 1–500 observations. Both the posted Measurement JSON and normalized database JSON must fit within 1 MiB.
4. Approve **Share with team**. Only the eleven whitelisted Measurement fields are serialized; images, OCR/report text, unknown backup properties, local report IDs and the full backup are excluded.
5. The server rechecks active Admin access and input, then imports through the ordinary user's session. SQL matches permanent athlete codes, checks canonical metrics/units and dates, preserves source observation IDs, and saves the batch atomically. Identical repeats are unchanged; conflicting observations reject the whole transaction. A renamed-file retry preserves the original filename and import provenance.

Private players read only their linked profile; coaches/admins can read the team. Shared observations are immutable through normal app writes. Clearing a browser workspace does not remove shared data, and restoring a browser backup does not automatically publish it.

## Account preparation is separate

**Team account preparation** (`/admin/rollout`) displays player readiness and stores reviewed coach names/contact emails. A preparation record is not an Auth user, does not grant a Coach role, and sends no invitation. **Account connected** verifies the trusted link/status, not completed password setup. The owner has said not yet to team emails. Keep sends disabled and unsent until explicit approval through the separate Account access workflow. See [INVITATIONS](INVITATIONS.md).
