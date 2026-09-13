# Team Progress and Compare Players

These read-only Staff Tools use fresh `requireImportAccess()` checks before any team query, the signed-in Supabase client, and existing RLS. Active Admins, Coaches and interactive Coach View can use both routes. Player View and actual Players cannot receive their team datasets. They do not change accounts, import data or send invitations.

## Team Progress (`/team-progress`)

Choose Physicality, Hitting or Throwing, then one exact measurement/source/unit. A compact diverging bar shows `(latest − previous) / previous × 100`; rows sort by absolute percentage change. The latest valid Fall result is compared with the previous distinct testing date. Identical same-day values are harmless; differing values on either comparison day withhold that change for review. Zero previous values have no percentage. Missing readings are never zero. Future dates and results outside the supported 2026 periods are excluded. Body results from June–August may supply a previous test but cannot complete a Fall test; baseball tests remain Fall-only.

Green/red for body changes follows the owner's display preference: muscle mass/body score up and body fat down are green; the reverse is red. Height, weight and fastball spin stay neutral. These are descriptive changes, not health or training recommendations. Higher/lower performance directions follow the existing metric catalog. Summary counts say Increased/Decreased rather than labeling all numerical movement as improvement.

Retest After defaults to 30 days with 7/14/30/60 options. It is a visible dashboard review setting, not a prescribed testing cadence. The expandable queue includes eligible players without a Fall reading, or with a latest reading older than the interval. Ambiguous latest results go to review instead. First tests remain distinct from repeat changes. Eligibility uses player type plus primary/secondary positions, excluding hitter and speed tests for pitcher-only players.

## Compare Players (`/compare`)

Type a player name and choose its unique name/PAC-code roster entry. Two distinct players are required. The same Physicality/Hitting/Throwing groups use current Fall readings, exact source and unit, original values and visible dates. The date-gap control defaults to 30 days. Missing/inapplicable/conflicting values remain labeled; no bar pair is drawn when latest test dates exceed the limit. Each pair shares a zero-based scale for that metric. Red and blue identify players, not winners; scales differ across metric cards.

Game Stats uses the current QPA Fall cumulative snapshot or a selected actual Pitching event. Snapshot, source, event and unit must agree for bars. Existing validated batting calculations and opportunity denominators are reused; no raw AB/H cards or invented ISO/wOBA are introduced. Small sample labels remain visible. Pitching events stay separate rather than constructing an unsupported season rate.

Only the existing main metric catalog is serialized for these testing views; skeletal muscle and historical muscle percentages are retained in storage but not promoted into new cards. Game data is projected into numerical display fields and sample sizes without source-grid coordinates or file hashes. Analytics keeps its existing limited physicality/QPA choices and output contract.

## Validation

Synthetic tests cover date/source/unit partitions, previous-date conflicts, zero baselines, missing/future/invalid readings, role eligibility, adjustable queues, same-snapshot game opportunities and event boundaries. Server tests cover denial before reads, bounded pagination and safe projections. Browser verification uses fictional fixtures for screenshots and desktop/mobile/theme checks; live checks record only aggregate success/failure signals.

Live rollout encountered an intermittent failed database authorization read. The trusted-access loader now retries that read once, re-reading all three authorization records. Persistent errors still fail closed; successful inactive/no-role results are not retried. Tests cover recovery, revocation on the new read, bounded persistent failure and non-retry of denied access. No previous permissions are cached or reused.

### Full roster picker

Compare Players now uses an explicit dropdown that opens the entire current-season roster and optionally filters by name or PAC ID. Selection stores the permanent UUID. Players without readings remain selectable and display missing results honestly. Comparison includes every current-season roster identity; progress and statistical cohorts keep their existing active/redshirt rules. Arrow keys and Enter select a result; Escape closes the list. No measurement, email, or account is required merely to choose an existing roster player.
