# AI writing tools (staff only)

Two optional features use Claude to write about saved Fall data. Both are staff-only (Coach, Admin, Coach View) and are hidden behind a "turns on once a key is added" message until `ANTHROPIC_API_KEY` is set in the server environment.

| Feature | Where | Data sent | Saved |
|---|---|---|---|
| AI Summary | Profile Overview, "Write summary" | The player's exit-meeting projection: metric labels, values, samples, team percentiles, week-by-week values, role/position/class/handedness. No name, PAC code or jersey. | No |
| Ask the Data | `/ask` (Coaching) | Pooled team rates, each eligible player's game-sheet rates and testing-board results keyed by PAC code, plus role/position/class/handedness. No names or contact details. | No |

- Server module: `lib/ai-server.ts` (model `claude-opus-5-5`, low effort, `fallbacks: "default"` under `server-side-fallback-2026-07-01`, cached data block, refusal and API errors shown as friendly messages).
- Names: Ask replies refer to PAC codes; `restoreNames` swaps them back on the server before the answer reaches the browser.
- Voice: shared ground rules keep answers descriptive (percentiles are team-relative, small samples flagged, no training/health advice or causal claims, body measurements neutral).
- Cost: roughly a few cents per summary and well under $0.25 per question at Claude Opus 5.5 prices; repeated questions within a few minutes reuse the cached data block.

## Setup

1. Create an API key at console.anthropic.com (owner's account).
2. In Vercel → Project → Settings → Environment Variables, add `ANTHROPIC_API_KEY` for Production (not prefixed with `NEXT_PUBLIC_`).
3. Redeploy. The summary button and Ask box appear for staff.

Tests: `tests/ai-features.test.ts`, `tests/ai-access.test.ts` (fictional data; the SDK is mocked, so tests never call the API).
