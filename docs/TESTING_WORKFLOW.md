# Staff testing workflow

**Testing** at `/testing` is available to active Admins and Coaches, including an Admin using interactive **View as Coach**. Players and read-only Player View as cannot open the checklist or enter measurements.

## Record a result without a file

1. Open **Testing → Enter Results**, or use **Enter Result** beside a player on the checklist.
2. Select the exact player from name/PAC ID suggestions, enter the actual testing date, and name the testing protocol or device.
3. Choose each measurement and unit, then enter its value. Height accepts feet and inches. Add more measurements for that same player, date and protocol if needed.
4. Select **Review Entry**, check the displayed player/date/values/units, confirm the review, then **Save Measurements**.
5. The receipt links to the player profile and the testing checklist. **Enter Another Test** starts a separate entry after a confirmed save.

Use a consistent protocol/device name for repeat tests. Manual entries are explicitly labeled `Manual testing · <protocol>`; they do not impersonate a RENPHO report or Full Swing export. Dates, units and source/protocol groups remain separate in profile comparisons. The form records only entered measurements; it never fills blanks with zero or calculates smash factor from unrelated results.

The form accepts actual body testing dates from June 1–December 31, 2026 and baseball/speed dates from September 1–December 31, 2026, no later than today in Pacific time. It rejects invalid calendar dates, invalid or duplicate metrics, unsupported units, invalid percentages, negative values and zero where a positive result is required. Reviewed same-unit averages cannot exceed the paired maximum in the same entry. Pitcher-only players have no hitting/speed choices; explicit two-way players retain them. Field throwing tests require the corresponding infield/outfield roster position.

## Fall checklist

Choose **Physicality**, **Hitting** or **Throwing**, then a test. The checklist shows **Needs Testing**, **Recorded This Fall**, and **Eligible Players** for that selected measurement. Players needing it appear first. Each recorded row shows the actual testing date; row actions can enter an initial result or a repeat test.

The cohort is the current 2026–27 roster with null, active or redshirt status, restricted to roles eligible for that test. Completion means a valid saved reading dated September 1–December 31, 2026 and no later than today in Pacific time. Earlier body reports stay on profiles and do not complete Fall testing. This is a recorded-result checklist, not an assessment of ability or a claim that an athlete has completed every test.

Muscle Mass % also counts when a reviewed Fall RENPHO report provides one valid weight and one valid muscle-mass reading for the same athlete, file, date and report page, both in the same lb or kg unit. The calculation is muscle mass ÷ weight × 100, as on the profile. An explicitly recorded percentage takes precedence within that report; incomplete, ambiguous or mismatched report pairs never complete the test.

Reads use the ordinary staff session with bounded, deterministically paginated queries and exact count checks. Missing pages, changed counts, duplicate identities and malformed responses produce a refresh error instead of a false empty checklist. No account/contact information is sent to the checklist. Source, value, unit and date stay together; different protocols and units are never averaged into a checklist result.

## Saving and retries

The server reloads the current eligible roster, validates the exact entry and checks live staff access before the existing user-session `admin_import_performance` RPC. Every observation carries the actual signed-in actor through the existing import audit. No new table, database grant, service key or account setup is required.

Each entry has a stable random submission ID and deterministic observation identities. Once saving begins, fields lock. If the response is uncertain, check the profile or explicitly choose **Retry Same Entry**; the reviewed payload and identifiers remain identical. An existing matching observation is counted as unchanged, and a conflicting observation is rejected rather than overwritten. No automatic retry occurs. Do not refresh or navigate away from an uncertain entry and re-enter it as a new test; that would create a separate submission identity.

A confirmed save refreshes profiles, leaderboards, testing and import history. Numerical results are not emailed. Existing invitation settings and daily sheet-monitor schedules are unchanged.
