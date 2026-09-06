# Team Leaderboards

`/leaderboards` shows reviewed testing measurements in Physicality, Hitting and Throwing. Every active, configured Admin, Coach and Player—including Players without a profile link—can see the minimal team results. This is an explicitly authorized exception for leaderboards; ordinary roster, profile history and raw measurement reads retain their existing Player-own policies.

Choose one metric, source/protocol, exact unit and testing period. Fall 2026 means September 1–December 31. Body metrics, including grip strength, also allow June 1–August 31 as a separate period. Timed agility tests appear in Physicality but remain Fall-only. Units and sources are never converted or pooled. Only measured members of the 2026–27 roster with null, active or redshirt status appear; no missing results are filled with zero. QPA/Pitching game snapshots remain in Game Stats and are not mixed into testing leaderboards.

Each athlete contributes the latest comparable observation by test date, then import time at millisecond precision, file hash and observation ID. This is the latest result, not the best historical result. Higher-direction metrics sort descending; timed/lower-direction metrics sort ascending. Equal values share competition places (`1, 1, 3`) with stable permanent-code ordering. Neutral body/spin comparisons omit the Place column and present numerical order without a health or performance rating. Direct readings display their exact stored numeric value; derived muscle percentage is marked approximate in the compact display and exposes its exact calculation value.

Muscle percentage is calculated only from one unambiguous compatible-unit weight and muscle-mass pair in the same canonical RENPHO report/date, with positive weight and muscle mass no greater than weight. A reported explicit percentage takes precedence. No synthetic raw observation is inserted. Leaderboards have no five-athlete minimum because minimal individual team results are authorized; profile percentile comparisons retain their separate minimum-five rule.

Migration `202609060011_team_leaderboards.sql` adds two public read-only RPCs using the ordinary signed-in session:

- `team_leaderboard_options()` returns available `{metricKey, source, unit, period, athleteCount}` choices.
- `team_leaderboard(p_metric_key, p_source, p_unit, p_period)` returns `{rank, athleteCode, name, jerseyNumber, position, profileId, value, measuredAt, source, derived}` rows. `profileId` is null for a real Player's peers. Sources are normalized approved protocol labels; filenames, report IDs, contact details, raw history and source coordinates are omitted.

The checked private definer functions pin their search path and JSON float precision, require current active Player/Coach/Admin roles, and return bounded results. Comparison choices and result pages each cap at 1,000 entries; oversized result sets fail instead of silently truncating. The private raw helper cannot be executed by application roles. No table RLS, write grants or account links are changed.

The server repeats role and exact response-field checks, validates canonical values/dates, result ordering and duplicate identities, and clears forbidden profile links for effective Player View as even though the underlying Admin JWT remains broad. Players may follow their own profile link; staff may follow team profile links. No public cache or authentication bypass is used.

Tests cover PostgreSQL permissions, same-session revocation, untouched Player-own RLS, minimal output, latest/tie rules, period/source/unit isolation, derived values and exact precision. Server/UI tests reject malformed or extra-field responses and verify neutral presentation, dates, empty states and profile-link limits. PGlite verifies PostgreSQL behavior, not the full hosted Supabase Auth/API stack.
