# RENPHO profile charts

These charts extend the owner's existing Next.js dashboard at the custom domain. They render in the existing browser-local application, using semantic figures, exact text values and CSS bars. No external chart runtime, data upload, additional stored data or health interpretation is introduced.

## Chart map and evidence contract

| View | Question | Form and fields | Scale and evidence |
| --- | --- | --- | --- |
| Body mass measurements | What mass readings were saved in this report? | Horizontal bars for supported mass metric/value pairs, separate figure per unit | Zero to a rounded maximum; all bars in each unit group use the same scale. Measurements overlap and are not summed. Exact selected athlete, file hash and test date. |
| Reported percentages | What percentages does this report contain? | Separate horizontal bars for each supported percentage reading | Fixed 0–100% scale. Individual percentages are not stacked or treated as parts of one whole. |
| Other report measurements | What are the remaining saved indicators? | Exact-value definition list, with each metric's own unit | No shared quantitative axis across unrelated units. No ratings or recommended targets. |
| Report history | How does one measurement compare between saved reports? | Chronological horizontal bars, one report per bar, exact metric and unit | Zero baseline; percentages retain 0–100%. Latest 12 available reports, with count and date window. Same-day reports remain separate and are identified by date, report number and source details. |

Palette: the existing Pacific red (#990000) for current values and the selected history report; neutral charcoal for other history reports, quiet gray tracks/axes, white background. Visible metric/value labels and a text 'Selected' marker carry meaning without color. No gradients, inferred ideal zones or health classifications.

Data sufficiency: the initial supplied layout has one saved report. A single history bar is explicitly a starting point, with no line, interpolated dates or claimed trend. Additional reports automatically become discrete comparisons. The current import scope does not supply segmental readings, reference ranges, target values, scores or impedance, so those are not charted. No query can recover observations that were not imported.

Every view retains measurement provenance. Report grouping and history are scoped to the selected permanent athlete code; source filenames do not determine identity. No averaging or first-pick resolution of duplicate metric/unit values is allowed. Ambiguous, unsupported or out-of-range rows are omitted with a notice for the selected report, while original measurement history remains intact. Chart selectors are local component state and do not modify the workspace.

## Reader behavior and QA

Open an athlete profile, select a saved report, then select a history measurement. Reports default to the latest test date, with deterministic import-time/hash tie breaks. Missing metrics stay missing; units remain separate. History details expose exact displayed values and file/page/row provenance. At most 12 history bars are shown; the full measurement-history table remains available.

The charts use responsive single-column layout on narrow screens and paired panels where space permits. Bar labels wrap, zero values retain a zero-length mark and explicit value, and extreme finite values cannot overflow scale calculations. Exact saved numbers are shown as JavaScript numbers; the original report's decimal formatting is not stored.

Validation covers pure grouping/selection rules and synthetic browser interactions at phone/desktop widths. Actual owner data is checked privately outside the repository, with aggregate pass/fail receipts only. Private measurements, report IDs, images and source filenames must not enter source fixtures, screenshots, traces or commits.
