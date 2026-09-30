# Weekly development plans

Weekly Plan lets an active Coach or Admin assign one focus and one to four drills to an existing player. The coach chooses the Monday starting the week, writes the drill names and optional player-visible cues, and deliberately selects **Share this plan with the player**. A separate coach note stays staff-only. Nothing is generated or shared automatically; this feature makes no training recommendations.

The profile card shows the focus, week, short drill list and a completion bar. The current week's plan is featured, with other weeks collapsed. Staff can edit, unshare, or archive a plan. One retained plan is allowed per athlete/week, with up to 104 plans per player for the supported August 31, 2026–December 27, 2027 Monday range. Weeks are explicit calendar dates and never inferred from result imports.

Only an actual signed-in Player linked to that athlete can mark a shared, unarchived drill done or undo it. A completion is the player's own check, not a recorded test result or proof of improvement. Coaches can review the checks but cannot impersonate a player. Player View as is read-only. Editing a completed drill's name or cue resets that drill's check; changing only the focus, private note or sharing does not. The editor explains this before saving. No imported readings, numeric goals, Coach Focus records, roster identities or account grants change.

## Persistence and access

Apply `supabase/migrations/202609300001_development_plans.sql` before the consuming app. It creates no actual plans. `player_development_plans` and the private request ledger have RLS enabled and no direct authenticated table privileges. Narrow ordinary-session RPCs recheck live roles/links, use the existing account → roster lock order, and require the exact expected revision. The athlete and week of an existing plan are immutable. A duplicate same-week create prompts refresh rather than replacing a plan.

Every save/check carries a stable request UUID. Same-actor, identical-payload retries return the stored receipt without incrementing the revision or repeating completion. A changed payload using the same request is rejected. The receipt is not returned after revoked access; completion retries also require the plan to remain shared and unarchived. Public audit details contain only IDs, revision, counts and booleans, never coach/player text. Private staff notes are projected away again for Admin-as-Player.

Save controls disable while pending and after an uncertain result. Errors ask the user to refresh and inspect the plan before making another submission. Successful actions revalidate the profile and Home. The database receipt, rather than a local success assumption, establishes the result. No service-role key, invitation, source-sheet change, push notification or external message is used.

## App integration

Use `loadDevelopmentPlans(access, athleteId)` from `lib/development-plans-server.ts` alongside existing authorized profile reads. Keep failures isolated so the rest of the profile remains available. Render `WeeklyDevelopmentPlans` from `components/development-plans.tsx` with `{plans, athleteId, staff: canImportPresentedAccess(access), canComplete: canCompleteDevelopmentPlan(access, athleteId), today}`. `today` is the current Pacific calendar ISO date from the existing app utility. The server component supplies unique request/drill IDs; no client role or supplied actor ID determines permissions.

Tests exercise the actual PGlite migration, staff draft sharing, player/peer/revoked access, no direct writes, own-player completion and undo, receipts, stale revisions, one plan per week, edited drills, malformed payloads, safe projection and action authorization. PGlite does not substitute for live Supabase Auth/API or browser checks. Use fictional data for visual QA.
