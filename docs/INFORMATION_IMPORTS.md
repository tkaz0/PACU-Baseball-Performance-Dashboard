# Information imports

> Current schedule (September 20): all scheduled QPA Fall, Pitching Fall, and Player Metrics workbook checks run once weekly on Monday at 9 p.m. America/Los_Angeles. Roster and RENPHO-ID scanning remain off. This supersedes historical daily-schedule wording below; source validation and ordinary-session save requirements are unchanged.

Open **Information Imports** at `/imports` while signed in as an active Admin or Coach. This page reads the live 2026–27 roster. Reviewed numerical readings save directly to the shared, private player profiles. Players have no import access. Admin View as Coach includes working performance imports; Player View as remains read-only. Every save is attributed to the real signed-in account.

For a result without a file, open **Testing → Enter Results**. The staff checklist shows which players still need each Fall test. See [TESTING_WORKFLOW](TESTING_WORKFLOW.md).

## Four upload areas

| Area | Input | Destination |
| --- | --- | --- |
| Physicality | Supported RENPHO Body Composition Analysis Report: PNG/JPG or one-page PDF, up to 10 MiB | Body measurements and RENPHO report charts |
| Hitting | Explicitly mapped CSV, up to 2 MiB | Max/average exit velocity, separate max/average bat speed, smash factor and max distance |
| Pitching | Explicitly mapped CSV, up to 2 MiB | Max/average pitch velocity, average fastball spin, strike/strikeout/walk percentages |
| Games / Intrasquad | Select Game or Intrasquad, then explicitly map a CSV | Separately labeled Full Swing game or intrasquad readings |

Each shared import accepts 1–500 reviewed readings within 1 MiB. Inputs retain the actual file hash, source sheet, row and column. Repeat observations are unchanged; conflicting remaps fail atomically. A filename change alone never overwrites the original provenance.

The coach-facing hub shows category and file type first. File limits, format details and templates live under **Report Help** or **CSV Help & Template**; column-header settings and measurement definitions are optional disclosures during review. The required player, date, units, summary confirmation and final approval remain visible at the appropriate steps. Google Sheet status and secondary tools are collapsed below the upload area.

## RENPHO

1. Drop in a complete supported report. OCR and the original image stay in the browser.
2. The report ID automatically selects its exact roster match. Confirm the player name and printed test date; if no ID is linked yet, select the player explicitly.
3. Compare every reading and unit with the original, correct or exclude values, then explicitly approve saving.

The reader fetches only numerical observations with the exact uploaded file hash to check repeats, including OCR line-position drift. It sends the extracted report ID to the private staff lookup and receives only the matching player UUID/PAC ID. The final RENPHO save checks the ID and selected player again in the same transaction as the readings. A known ID cannot save to another player; a missing/unknown ID allows explicit player selection without silently creating a mapping. Images, raw OCR text, health classifications and device targets remain in the browser. IDs are stored separately from performance observations. Optional remembered IDs in the advanced browser workspace remain local.

### Roster ID updates

The owner-authorized daily roster check reads the current **Renpho ID** header wherever it occurs and preserves IDs as text. Valid nonblank IDs tied to exact approved existing roster identities can be added through **Import History & Other Tools → Roster RENPHO IDs** (`/admin/import/renpho`) using a prepared private JSON file with `{ "mappings": [{ "athlete_code": "PAC-0001", "renpho_id": "FICTIONAL-ID" }] }`. The displayed example is fictional. This Admin-only page previews player names and requires review before saving. Actual Coaches and interactive Coach View use the shared matches but cannot manage identity mappings.

Mappings are additive: previous IDs still match, blanks do not delete links, and an ID cannot be transferred between athletes. Duplicate/ambiguous IDs and entries for unapproved new players remain pending. No accounts are provisioned and no invitations are sent. Daily synchronization depends on this Mac, the Drive connection and a valid administrator session; updates are available after a successful check rather than instantly upon editing the Sheet.

## Full Swing readiness

**The owner supplied a Field / Live at Bat export on September 17.** Games / Intrasquad now detects that exact 28-column layout and prepares player summaries. The owner confirmed the sample is a September 11 intrasquad session using mph and feet. Every subsequent file requires explicit confirmation of these units. Other raw layouts remain unsupported; manually reviewed summary CSVs continue to work in all lanes.

The session reader groups hitters and pitchers separately by their exported identity. It calculates maximum/average measured exit velocity, maximum/average measured bat speed, maximum distance, and maximum/average pitch velocity. Each average uses only its own recorded readings; literal `null` and blank cells are missing, never zero. Review shows metric-specific sample counts and original CSV rows. Names require unique exact roster matching or an explicit manual choice. No accounts or permanent ID links are created.

The sample has no pitch-type or outcome columns. It cannot supply fastball-only spin, strike/K/BB rates, or official game batting totals. Potential exit speed is not measured exit velocity. Smash factor is retained in the original file but not aggregated until a session-summary definition is chosen. Google game totals remain separate.

Only one complete dated Fall session per file is accepted. Repeated pitch numbers, conflicting name/ID pairs, mixed dates, invalid measured numbers and altered headers require review. Upload a complete session once: identical file reimports retain the existing provenance-based duplicate handling, but overlapping/re-exported files with different bytes are not automatically reconciled. The review explicitly confirms the session has not been imported from another export.

Derived observations retain the original file hash/name under `CSV · Full Swing session summaries v1`, with distinct derived-summary row/column coordinates. These are explicitly summary rows, not original pitch rows; the review's sample evidence lists the original rows used. No raw files, vendor IDs or names are added to the numerical save payload. The supplied private sample is kept outside Git and has not been saved to production profiles.

Each row must already contain one player's session summaries. Map player name, PAC ID or email; review exact matches, map alternate export names to a roster player, or leave them excluded. Unmatched/ambiguous names are skipped by default and do not block matched players. Choose the original date and units, then select only supported profile metrics. Percentages are 0–100 percentage points. Average fastball spin must already exclude other pitch types. Repeated player/date/metric rows block saving rather than silently selecting a raw event as the maximum or average. Average EV, bat speed and pitch velocity cannot exceed their matching maximum in the same unit. Generic Bat Speed remains separate; smash factor and distance must be explicitly supplied, not derived from other summaries.

Only September 1–December 31, 2026 dates are accepted in these Full Swing flows. Hitting, Pitching, Game and Intrasquad use distinct source labels so comparisons do not mix their protocols. Raw CSV files stay in the browser; only approved numeric observations and provenance are sent.

Blank PACU summary templates are downloadable from each lane. These are explicitly labeled as our templates, not vendor exports. No fake readings are included.

## Other tools

The hub links to shared import receipts, the advanced browser importer, and the Admin-only roster importer. Advanced CSV/TSV/XLSX mapping and backup restore remain available within their existing permissions. The separate Fall 2026 Google Sheets snapshot workflow is described in [GAME_STATS](GAME_STATS.md); Google game totals never become Full Swing readings.

Account invitations remain disabled and unsent pending the owner's review.

For grip strength and separate infield/outfield velocity, use **Testing → Enter Results**, or the advanced measurement mapping and shared-review path. These are not extracted from RENPHO reports or inferred from Full Swing pitch velocity. Existing active Coaches and an administrator choosing **View as Coach** can import through the same performance tools. Coach view does not grant roster, account or backup management. It uses the existing administrator session rather than creating a second login.

### September 17: complete session review and pitch ranges
The raw Full Swing review lists selected roster batters and pitchers, including matched players without measured hitting values. Unmatched/export-only names remain in the matching panel, outside stat summaries. Search filters both summary tables and pitch ranges; it never changes which measurements are proposed for saving. Each measurement shows its own recorded sample count. Blank values remain missing.

Pitch range review uses separate pitcher groups and half-open velocity bins (2, 5 or 10 mph) crossed with spin bins (100, 250 or 500 original export units). The reviewer may confirm RPM for the display label. Missing/unreadable spin remains separate and does not block valid summary measurements. These ranges do not infer pitch types and are not saved to profiles; the existing seven reviewed summary metrics and save confirmation remain unchanged.

### September 17: reviewed pitch-type assignments
Admins and Coaches can assign a whole velocity/spin range or individual pitches, including pitches with missing spin. Assignments use the original CSV row, so changing the range widths does not change their labels. The review shows per-type counts and separately sampled mean velocity/spin. Saving labels is separate from saving the seven player summary measurements; no pitch-type-specific measurements or official outcomes are inferred.

After confirming RPM, optional suggestions start from the owner-provided guidelines: Fastball 75–85 mph and 1,900–2,200 RPM; Breaking Ball 65–70 mph and above 2,200 RPM; Changeup 68–72 mph and below 1,900 RPM. The changeup speed interval is a reviewable interpretation of “around 70.” Each pitcher's guidelines can be adjusted independently for the current review. Multiple matching types, missing measurements or unsupported patterns remain unknown. Applying suggestions fills only unassigned pitches; staff must review and explicitly save. Generic Fastball/Breaking Ball labels do not assert four-seam, slider or curveball subtypes.

`202609170001_pitch_assignments.sql` saves only exact file SHA-256, original row/type assignments, revision and staff audit identity in a private table. Active staff may load/save through a bounded ordinary-session RPC; players and anonymous users are denied. Optimistic revision checks reject stale conflicting saves; identical retries return the existing state. Reopening the exact CSV restores shared assignments. Changed exports have separate fingerprints. Guidelines themselves reset on reopening; the saved pitch labels persist for staff. No raw CSV, player names, vendor IDs, spin or velocity values enter annotation storage.

### Roster-only session imports
Full Swing and Blast summary review defaults to skipping identities without a unique exact roster match. Staff can explicitly exclude any export name or select an existing roster player; changing selection invalidates the final review. No athlete is created. The matching panel and save review disclose skipped counts. Summary tables, samples, pitch ranges and suggestions show selected roster identities only. Search remains a display filter, separate from the import selection.

Filtering happens after the raw session is summarized, so a rostered hitter retains results against an excluded pitcher and a rostered pitcher retains results against an excluded hitter. Original derived-summary row numbers, source columns and file hash remain unchanged for repeat-import detection. Pitch annotation loading still validates against the full original file; saving edited visible labels preserves previously saved labels for excluded pitchers. Files and exclusion choices remain local to the open review; reopening defaults to current exact roster matches. No migration or new access grant is needed.


Full Swing numerical displays use exactly one decimal, preserving raw precision. Saved pitch labels now support a separate **Save Pitch Results to Profiles** step after matching, RPM and pitch-type review. It saves max/average velocity and spin plus sample counts for each known pitcher/type in the original session; unknown pitchers and unassigned pitches are excluded. Saved source observations remain immutable: re-importing identical results skips them, while later conflicting classifications require a correction review. Label changes alone do not automatically rewrite published measurements.


Session Type now offers Practice for the already-reviewed Field / Live at Bat CSV and mapped summaries. This changes the source context, not the accepted vendor schema. Saved classified Practice pitch results appear on the Practice profile tab and Practice rankings. Regular Hitting/Pitching summary lanes and Blast also remain Practice. Game and Intrasquad remain In-game. Do not re-import an existing file under a new context to bypass immutable observations.


Pitch grouping defaults to gaps: adjacent velocities within one pitcher/spin band stay together until a gap of at least 3 mph. A connected group may span more than 3 mph. Fixed bins (including 3 mph) remain selectable; missing velocity/spin stay separate and original CSV coordinates never change. Classification still requires staff review. Player Matches opens visibly and offers No player / Skip these stats; exclusion removes any prior manual match from the current preview, summary and classified-result payload while preserving known opponents’ recorded events. Skip affects this import only; already saved mistaken CSV results use the Admin profile’s Correct CSV Assignments tool.


## Blast Weekly Performance Reports — September 20

The Blast Motion lane supports the owner-supplied 16-column Average Performance and Peak (95th Percentile) CSV layout. Staff choose the report type and exact reporting start/end dates, review split-name roster matches and skipped players, inspect every measurement, and confirm before saving. The first reviewed period is September 13–20, 2026. Files stay in the browser; only reviewed numerical observations use the existing ordinary Admin/Coach save path. Custom mapped summaries remain available separately.

Weekly averages and vendor P95 summaries use separate source labels containing the exact reporting range. Bat speed maps to Average Bat Speed or Peak Bat Speed (95th), never Max Bat Speed for a P95 file. Peak Hand Speed remains the underlying metric name in both reports. Swing counts describe each export and are never added across the paired reports. Original numeric precision, signed angles and CSV row/column IDs survive import. Time values display three decimals; other measurements display one and counts display integers. Blank metrics stay missing.

Practice profiles show a compact weekly Average/Peak table with metric explanations. The period-end date is the observation anchor, explicitly displayed as a reporting period rather than a single testing session. No individual swings, health targets, optimal-angle thresholds or new scores are inferred. Weekly periods remain separate; summaries are never averaged together. P95 bat speed is a separate profile/leaderboard metric, unavailable for generic manual testing entry.

Deploy the app before applying `supabase/migrations/202609200001_blast_performance_reports.sql`. The additive catalog and narrowly scoped signed-angle validation preserve existing RLS, staff role checks, immutable observation conflicts and account grants. Identical-file retries remain idempotent. A different file for an already saved player/metric/report period is rejected for staff review rather than silently combined. Save attempts lock the reviewed payload for identical retries.

Staff may edit Report Name before review. The name is saved as the readable `source_file` label with a `.csv` suffix. Renaming never changes the file hash, original row/column identity, summary type or reporting period; identical-source retries retain the original saved label.


## Fall Practice Summaries — September 20 Update

The owner chose a cumulative Fall Practice view, with bat speed, hand speed (the export’s Peak Hand Speed metric), attack angle, early connection and vertical bat angle as the five main measures. Weekly exports should contain only new swings with non-overlapping dates. `lib/blast-fall.ts` computes a display-only weighted average: sum of weekly average × reported swing count, divided by included swing counts. It never pools Full Swing with Blast, counts the paired P95 export again, or averages percentiles. Missing a metric in any included average report withholds that metric’s Fall average. Missing counts, duplicate reports, mixed athletes or overlapping average periods withhold the rollup for review. Original observations remain unchanged.

Own-player Overview shows five compact Fall-average cards. Practice shows those five cumulative averages beside the latest available week’s P95 values, with the peak reporting dates explicit. A Fall P95 cannot be reconstructed from weekly P95 summaries. Other Blast measurements remain saved for staff history but are no longer main profile cards. Weekly Blast percentile cards are replaced on profiles by the cumulative summary; no unverified cumulative team percentile is inferred from a weekly percentile. Existing leaderboard source partitions remain weekly reports. In-game and Practice bat-speed labels are explicit in profile cards, overview comparisons, highlights and trend labels.

Apply `202609200002_blast_period_guard.sql` after the compatible app. It blocks new overlapping report ranges for the same athlete and summary type via the existing ordinary staff save. Average and P95 paired ranges are allowed; identical retries keep existing behavior. It creates no account grants and changes no stored measurements. Dates are inclusive: the next report after September 13–20 should start September 21 or later.
