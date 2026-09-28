# Pitch Arsenal Visuals

Pitching profiles use the existing authorized own-athlete `FallArsenalPitch` summaries. Every Game, Intrasquad and Practice source is displayed separately; staff-assigned types and fastball subtypes are never pooled. The full table retains independent velocity/spin averages, Fall maxima, dates and verified reading counts. The speed/spin scatter and classified-pitch mix remain descriptive.

## Pitch Separation

The In-Game and Practice profile tabs add a speed-separation panel below each source’s arsenal charts. The compact Overview keeps its existing table without the extra chart. This is local presentation of already-authorized numerical summaries, with no new reads, stored measurements, account permissions or database migration.

The reference is one actual recorded Fastball, Four-Seam Fastball, Two-Seam Fastball, Sinker or Cutter. A single available reference is shown explicitly. Multiple available references require the user to choose; no type is silently preferred, inferred from velocity/spin or averaged with another. The choice remains local to that panel. Other recorded pitch types, including other fastball subtypes, remain individually labeled.

The gap is `reference.averageVelocity − pitch.averageVelocity`, using unrounded mph values. Its label says how many mph slower or faster the other pitch averages. Values and gaps display one decimal; ranks, saved values and weights are unchanged. A sub-tenth difference can display `0.0 mph gap` without claiming exact equality.

A gap requires all of the following:

- One unambiguous summary per exact source/type for the same athlete and Game, Intrasquad or Practice context.
- Finite positive average velocity and verified positive integer **velocity** reading counts for both pitches. Total pitches or spin counts are never substituted.
- The same averaging basis: weighted Fall average compared with weighted Fall average, or latest-session average compared with latest-session average.
- Identical average start/end dates within September 1–December 31, 2026 and no dates later than the current Pacific-calendar day. A latest-session interval must be one date. Counts may differ; matching bounds do not claim every pitch came from identical sessions.

Noncomparable rows retain their available average/count/date context and explain why the gap is withheld. Missing, invalid and ambiguous readings never become zero; future or invalid-date averages are withheld. Missing reference types show a short empty state. The source table remains the full recorded arsenal even when a gap cannot be calculated.

The horizontal connector spans the two averages on one labeled mph scale, with a blue dot for the other pitch and a dashed fastball reference. It encodes a difference rather than a zero-based absolute magnitude. Exact average values, date windows and samples remain visible beside the plot. Faster/slower labels and marker shapes distinguish the values without relying on color; there is no ideal-gap band, performance grade, spin recommendation or causal claim. The information control explains the calculation and source restrictions.

`tests/pitch-separation.test.ts` covers reference choice, full-precision subtraction, signed/near-zero gaps, date/basis/count safeguards, ambiguous summaries, source isolation, visible values and explanations, labeled selection, empty states and profile-tab integration. Synthetic fixtures contain no team data.
