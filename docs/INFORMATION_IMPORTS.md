# Information imports

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

**No actual Full Swing export was available for this release.** The labeled upload areas support manual review of summary CSV columns; they are not a validated automatic Full Swing parser. The first real export is needed before adding a vendor-specific adapter, including any individual-swing/pitch aggregation.

Each row must already contain one player's session summaries. Map player name, PAC ID or email; explicitly resolve unmatched export identities against the roster. Choose the original date and units, then select only supported profile metrics. Percentages are 0–100 percentage points. Average fastball spin must already exclude other pitch types. Repeated player/date/metric rows block saving rather than silently selecting a raw event as the maximum or average. Average EV, bat speed and pitch velocity cannot exceed their matching maximum in the same unit. Generic Bat Speed remains separate; smash factor and distance must be explicitly supplied, not derived from other summaries.

Only September 1–December 31, 2026 dates are accepted in these Full Swing flows. Hitting, Pitching, Game and Intrasquad use distinct source labels so comparisons do not mix their protocols. Raw CSV files stay in the browser; only approved numeric observations and provenance are sent.

Blank PACU summary templates are downloadable from each lane. These are explicitly labeled as our templates, not vendor exports. No fake readings are included.

## Other tools

The hub links to shared import receipts, the advanced browser importer, and the Admin-only roster importer. Advanced CSV/TSV/XLSX mapping and backup restore remain available within their existing permissions. The separate Fall 2026 Google Sheets snapshot workflow is described in [GAME_STATS](GAME_STATS.md); Google game totals never become Full Swing readings.

Account invitations remain disabled and unsent pending the owner's review.

For grip strength and separate infield/outfield velocity, use **Testing → Enter Results**, or the advanced measurement mapping and shared-review path. These are not extracted from RENPHO reports or inferred from Full Swing pitch velocity. Existing active Coaches and an administrator choosing **View as Coach** can import through the same performance tools. Coach view does not grant roster, account or backup management. It uses the existing administrator session rather than creating a second login.
