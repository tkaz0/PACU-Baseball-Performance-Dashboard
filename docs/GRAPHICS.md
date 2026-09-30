# Graphics Studio

Open **Graphics** from the Team sidebar. Use the single **Graphic** dropdown to choose a card, then select its player and stats. Staff choose players through one searchable dropdown; linked players use their own results. Player Card and Instagram portrait size are the defaults. **Save Image** and **Copy Caption** sit above the preview, so the main workflow is choose, preview, save.

**Save Image** downloads a PNG. **Copy Caption** copies a short social caption with the displayed numbers, compact source/context badge, relevant sample counts, overall dates, necessary calculation caveats and site link. It does not copy the full report-style evidence. The app never posts, sends or uploads the graphic automatically.

Open **Customize** for an optional headline, colors, included stats, top-five/top-ten leaderboard selection, Square size or **Download Editable SVG**. Open **Caption & Stat Details** separately to review the full source labels, per-result dates, report counts, comparison samples, pitch-family windows and calculation assumptions. The short caption is available to select and copy manually; the nested Full Stat Details review also retains the independent-project disclosure.

## Templates

- About PACU: an introduction to the site without player data.
- Player Card: a player and selected measurements or game stats.
- One Stat: one selected measurement or game stat.
- Team Percentiles: existing verified Pacific team percentiles, with blue/red bars.
- Pitch Arsenal: staff-classified pitch velocity/spin averages and maximums, plus a paired plot when space permits.
- Progress: repeat testing on distinct dates using one metric/source/unit/period.
- Team Leaders: top five or ten rows with original ranks, ties and sample sizes; staff only. Per-player measurement dates remain in the full review caption.
- Compare Players: two authorized players with exact comparable metric/source/unit/context partitions; staff only. Shared Stats offers only metrics recorded for both players; the card refuses a partially matched selection.

The quick **Post Size** presets are Instagram 4:5 (1080×1350), Story 9:16 (1080×1920), and X 16:9 (1600×900). Square 1:1 (1080×1080) is inside Customize. Black, Red and Cream colorways preserve official brand proportions. These are local output-size presets, not integrations with the named platforms. The preview uses the same SVG document as both PNG and editable SVG downloads.

Every selected stat, ranking row, comparison row and pitch must fit in the chosen image. If a selection is too dense, the studio shows a format error and offers Story size or fewer selected stats; it never silently omits rows. Review the preview before saving.

Per the owner's latest request, exported images intentionally have **no bottom information block**: source/date paragraphs, formula notes and the independent-project footer are removed from the image. A compact source/context/season badge and necessary inline samples remain. Pitch cards keep compact Fall-average/latest-average bases, average reading counts and Fall-maximum labels. The short social caption retains relevant assumptions; the optional full review preserves all numerical context and the disclosure. Changing the presentation never merges source partitions or removes the underlying evidence.

## Access and data

The page uses trusted render access and only queries roster choices for effective Admin/Coach roles. The POST data endpoint independently authenticates, checks same origin, accepts only the small player-or-leaderboards selection contract, and returns private/no-store results. Lower readers repeat scope checks. Players and Player View can request only their linked athlete; team boards and head-to-head options are staff-only. No ordinary reads use the Auth admin client or a service-role key.

The graphics reader reuses the app's validated sources and role eligibility. Game/Intrasquad/Practice and Summer/Fall remain separate even when selector labels are shortened. Full Swing averages use independent verified counts for velocity and spin when complete; latest verified fallback averages stay labeled. Average windows and maximum dates remain in the full review caption. Full Swing values retain one displayed decimal. Blast Fall averages are count-weighted, and weekly P95 stays separate. Game comparisons include exact snapshot refresh time in their matching key. Percentiles require the existing comparable cohort. Trends require repeated valid dates; unavailable data is never fabricated.

The card model separates compact image fields from caption-only details. The renderer ignores `source`, `updated`, `footerNotes` and `captionDetails` and renders the compact `kicker` plus selected values. Its explicit SVG allowlist excludes all contact information, PAC codes, UUIDs, file names, hashes and raw report provenance. It escapes text, refuses external/active image content, uses local system fonts and preserves brand proportions. Captions retain only authorized display evidence, never raw report identifiers. All image composition and downloads occur locally in the browser; the app does not publish posts or create public access to profiles. No schema changes, saved records or invitations are involved.
