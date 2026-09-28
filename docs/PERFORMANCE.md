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
