# Exit Meetings

`/exit-meetings` is a staff-only player meeting workspace. Choose a current 2026–27 roster player, review the full report, choose the meeting date, optionally add talking points, and download a real PDF. It supports a staff profile shortcut with `?athlete=<existing UUID>`.

## Access and privacy

- The page uses `requireImportAccess`; both server reader and download route enforce the effective staff role. Actual Coaches and Admins in interactive Coach View are allowed. Players and Player View are blocked before any roster or result query.
- Every PDF request rechecks the live signed-in account with `getAccess` and uses ordinary-session, player-scoped readers. No admin Auth key or service role is involved.
- The POST body contains only the selected UUID, meeting date, and optional talking points. Client-supplied statistics, roles, and other keys are rejected. Same-origin requests only, bounded 12 KB request body, valid calendar date, and at most 1,600 note characters.
- All PDF and error responses use private `no-store` caching. PDF bytes are generated in memory and downloaded; reports and meeting notes are not persisted or emailed. Changing players resets unsaved notes, including browser back/forward navigation.
- The report model whitelists display values. It excludes emails, RENPHO aliases, source filenames/hashes/row coordinates, account details, and private staff notes.

## Report contents and calculation rules

The opening snapshot contains basic roster information, known testing dates, strengths, development areas, and biggest jumps. Subsequent sections include all currently available relevant profile measurements, available team percentiles, cumulative game rates and supporting totals, classified pitch sessions, Blast Fall averages and every saved weekly Average/P95 report, Full Swing paired-contact quality, complete latest RENPHO numeric results and left/right balance, and latest movement screening.

- Reuse canonical profile, game-rate, Blast, movement, and body-report models. Do not invent a new score or generate training/medical advice.
- Profile metrics keep their latest source/unit/period values; timed tests use best time with the existing arithmetic average and trial count. Report footnotes distinguish these from Fall-wide leaderboard aggregations.
- In-Game and Practice remain separate, as do devices. Classified pitch summaries keep each saved file/date/context separate, even for multiple files on one day. Velocity/spin reading counts are shown. Generic Full Swing profile sample counts are explicitly unavailable in this reader; never infer them from summary rows or reuse a cumulative leaderboard count for a latest-session value.
- Percentiles require a verified exact comparison and at least five measured teammates. Body fat is reversed only by the canonical profile model. Neutral body/spin measurements are not strengths or development areas. Strength/development highlights use the same profile-level non-body directional metrics, the existing 75th/25th cutoffs, and valid game opportunities.
- Blast Fall averages are swing-weighted only for complete, non-overlapping reports. Weekly P95 is separate, never a Fall maximum or pooled percentile. Missing or overlapping averages remain unavailable. All recorded weekly measurements remain visible, including signed angles. Weekly percentile bars are attached only to the same exact recorded profile comparison.
- Cumulative pitching sums distinct reviewed source periods once, using exact outs. Runs/9 uses all runs, not ERA. Contact rates use Wk+Hrd. Undated weeks never become dated games. Snapshot update dates display in Pacific time.
- Full Swing contact quality includes only saved paired readings in the same context. Team thresholds are EV 90+ mph, angle 8–32°, and both. These are contact descriptions, not actual hit outcomes or QPA HH%.
- Movement colors preserve source ratings; ankle flexion/extension are 1–5 ratings, shoulder/hip ROM use degrees. RENPHO balance uses the existing 10% review flag, not a medical cutoff.
- Pitcher-only reports hide hitting/speed sections. The visible report sets Last Tested; a hidden test cannot advance it. Missing sections are named without inserting zeros.

## PDF layout and implementation

`lib/exit-meeting-pdf.ts` uses `pdf-lib` on the Node runtime, with a 60-second route limit. It embeds the existing Boxer Dragon SVG paths as vector artwork, uses source/date/sample labels beside each number, renders blue-to-red percentile bars, wraps long labels/notes, and breaks pages before rows overflow. No network font or image dependency is needed. Every page has a private-player footer and page number. The final guide explains missing comparisons and source limitations.

The UI opens report sections from its contents links and provides all results for review. The PDF re-reads current saved data when downloaded; it does not treat a stale browser preview as the data source. A failed source reader blocks the PDF rather than silently generating an incomplete report.

## Validation

Tests: `exit-meeting.test.ts`, `exit-meeting-access.test.ts`, `exit-meeting-pdf.test.ts`. They cover source/context isolation, correct batting and pitching calculations, role scope, data minimization, sample/cohort gates, Blast overlaps, movement units, authentication and request validation, no-store responses, source failures, and real multi-page PDF generation.

For synthetic visual QA only, set `EXIT_MEETING_QA_DIR` while running the PDF tests. It writes clearly fictional normal/stress reports outside Git for Poppler rendering. Production exports are never fixtures or screenshots. No database migration, identity changes, or invitation sends are required for this feature.
