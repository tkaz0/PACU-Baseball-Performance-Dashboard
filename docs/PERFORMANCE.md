# Read-page performance

The September 27 changes reduce redundant work without shared private caches or database migrations.

- `lib/render-access.ts` uses React `cache` for the current Server Component render only. Workspace shell and read pages share one live `getAccess()` result. There is no TTL, module-level Map or Next persistent cache. Never import render guards into mutations, Auth, API routes or PDF downloads; those retain `lib/auth.ts` fresh guards. A new request or role preview gets a new authorization result. RLS remains authoritative.
- The small staff player-choice projection can be reused within that same render using its exact authorized access object. Player presentation still returns before any roster read.
- Profiles load independent game/measurement/movement/contact/focus readers together, after player identity and effective access are checked. Pitcher-only profiles skip hitter contacts and hitting team averages; explicit two-way profiles retain both. Own-history pagination remains sequential because that RPC does not advertise a stable total; its percentile summary starts alongside it.
- Player Home does not query a percentile summary it never displays. Its history validation and own-athlete restriction are unchanged.
- Analytics, comparisons and staff Home read roster and game data concurrently. Measurement pagination validates the complete first page/count, then requests at most three pages concurrently, preserving order and all count/bounds/duplicate checks. A failure never becomes a partial successful dashboard.
- Correlation map cell selection and scatterplot hover reuse existing paired data/fits. Axis, source, unit, period, date window and cohort changes still recalculate.
- Public `/brand/`, `/report-assets/` and exact `/icon.svg` assets do not run session middleware. These contain only repository/package assets. Protected HTML, API, downloads and routes with image-like names still run session middleware and no-store headers.

The changes reduce sequential request stages and repeated calculation; they do not establish a guaranteed latency or a measured production speedup percentage. Database size, provider response time and network conditions still affect load time. Next candidates are a validated aggregate-only Home reader and batching leaderboard RPCs after query-plan measurement, followed by loading hidden profile details only when opened.

September 29 staff-page reliability: the shared Analytics/Comparison/Progress/Testing/Home reader uses sequential groups of ten permitted athlete IDs, keeping the existing RLS, date bounds, exact per-page counts, duplicate checks, and 20,000 total-reading cap. Only a provider error with the exact SQLSTATE `57014` may split one failed group into two smaller reads. All outstanding pages settle first, and partial attempts publish neither measurements nor arsenal rows. Changed counts, malformed rows, incomplete pages, access errors, and source limits remain failures. Server diagnostics include only fixed reasons and allowlisted error codes; never provider messages or private rows. The intermittent live failure was confirmed in the team page-read path, but its original provider code was not exposed by the prior release.


# October 4 loading performance

The October 4 update reduces work on initial Home and profile requests without changing statistics or permissions. No database migration is needed.

## What loads when

- Profiles accept Overview, Physicality, In-Game, Practice and Progress through a validated `?tab=` parameter. Unknown or repeated parameters open Overview. Browser history and links preserve the selected tab. Only the selected panel is rendered and sent to the client.
- Core own-player measurements and percentiles still load on each profile request because highlights, Fall bests and weighted summaries depend on history. Physicality loads movement screenings; In-Game and Practice load only their matching contacts and videos; Progress loads training counts and staff history. Optional failures retain their existing notices.
- Home starts independent readers together. The staff summary reads only Fall measurements, with ten-player partitions sharing a three-query queue across pagination and timeout splits. It still validates exact counts, complete partitions and the combined 20,000-observation limit before returning a summary. Failed partitions never publish partial results.
- Home and Team Game Stats show current results before optional historical trend charts finish. Snapshot metadata is read first; only the final source version on each Pacific day receives an observations read, within the existing last-40-version window. Missing or inconsistent versions withhold trends.

## Authorization and data

All readers retain ordinary session authorization, RLS and effective View as restrictions. React cache is limited to a single server render; private data and authorization are never cached across users or requests. No observations, classifications, source hashes, accounts, imports or scheduled checks change. Full report callers retain complete contact history.

## Verification

Run lint, TypeScript, the full Vitest suite and a production build. Regression tests cover tab-specific readers, own-player and preview restrictions, context-specific contacts, complete bounded Home reads, failure draining, URL validation and authoritative daily trend payloads.

In the live signed-in dashboard, compare Home and a profile before/after using the same browser, exact URL and visible-ready condition. Treat individual timings as noisy samples rather than guaranteed improvements. Verify that stats and percentiles are unchanged, all tabs and browser back/forward work, current Game Stats render, and mobile pages have no horizontal overflow. Avoid logging identities, values or session credentials; use privacy-safe crops for proof.

## Remaining limits

Home still reads Fall history to produce coverage and coaching updates. Profiles still read the player's core history to calculate bests and cumulative results. A future database summary projection could reduce those reads further, but would require its own reviewed schema, access checks and verification.

## October 4 compact Home follow-up

This follow-up supersedes the earlier note that initial Home waits for full measurement history. Migration `202610040001_home_measurement_summary.sql` adds a stable invoker read with the existing live account/RLS boundaries and limits. Main Home awaits only compact athlete/metric/unit/source coverage metadata plus current game stats, leaderboards and other small existing readers. It never waits for numerical measurement history to produce its main totals. Coaching pulse and since-last-visit changes share one separately streamed history promise, preserving all previous best/change/source rules. Activity failures display a notice rather than zeros; failed activity never mounts the visit-recording component. No shared cache or service credential is introduced.

Detailed history still loads for those activity sections; this is reduced main-page dependency and transport, not elimination of all history work or a guaranteed speed percentage. Coverage uses the same eligible cohort, Fall period, own-role filtering, latest dates and distinct-player counts. The compact response must reconcile its complete group counts and exact scope.

Profiles keep URL-selected Quick/Full Detail. Quick physicality avoids movement-screening reads, and hidden supporting sections are not serialized. Classified arsenal values and muscle-balance review remain visible. Core history still supplies cumulative stats and Fall bests. Consistency charts are computed from already authorized paired contacts without additional database reads.


October 4 EV presentation: numerical staff readers use the security-invoker performance_display_measurements projection; compact Home coverage remains original metadata. Fall EV rollups, aggregate means, own history and percentiles use one rule/retained denominator. Review and import receipts stay on immutable source tables. No browser-side team fetch, new private cache, extra source scraping or service-role access.
