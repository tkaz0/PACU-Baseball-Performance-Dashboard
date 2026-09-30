# Graphics Studio

Open **Graphics** from the Team sidebar. Choose a template, then a player or team stat when needed. Pick a result source, stats, optional headline, format and color. The preview uses the same SVG document as the downloads. PNG files are suited to posts and messages; SVG files stay editable. Suggested captions can be copied and edited before sharing.

## Templates

- Dashboard Showcase: an introduction to the site without player data.
- Player Snapshot: a headline result and supporting numbers.
- Stat Spotlight: one selected measurement or game stat.
- Percentile Card: existing verified Pacific team percentiles, with blue/red bars.
- Pitch Arsenal: staff-classified pitch velocity/spin averages and maximums, plus a paired plot when space permits.
- Progress Report: repeat testing on distinct dates using one metric/source/unit.
- Team Leaderboard: top five or ten rows with original ranks, ties, sample sizes and dates; staff only.
- Head-to-Head: two authorized players with exact comparable metric/source/unit/context partitions; staff only.

Square is 1080×1080, Portrait 1080×1350, Story 1080×1920, and Widescreen 1600×900. Colorways are Boxer Black, Pacific Red and Classic Cream. Dense cards explicitly identify omitted rows or ask for a taller format; source/formula notes are never silently dropped. Top-ten and arsenal templates default to Story. Download only after reviewing the preview.

## Access and data

The page uses trusted render access and only queries roster choices for effective Admin/Coach roles. The POST data endpoint independently authenticates, checks same origin, accepts only the small player-or-leaderboards selection contract, and returns private/no-store results. Lower readers repeat scope checks. Players and Player View can request only their linked athlete; team boards and head-to-head options are staff-only. No ordinary reads use the Auth admin client or a service-role key.

The graphics reader reuses the app's validated sources and role eligibility. Game/Intrasquad/Practice and Summer/Fall remain separate. Full Swing averages use independent verified counts for velocity and spin; fallback averages, max dates and each time window remain labeled. Full Swing values retain one displayed decimal. Blast Fall averages are count-weighted, and weekly P95 stays separate. Game comparisons include exact snapshot refresh time in their matching key. Percentiles require the existing comparable cohort. Trends require repeated valid dates; unavailable data is never fabricated.

The renderer receives only visible text, numbers, dates and a local PNG logo. Its explicit SVG allowlist excludes all contact information, PAC codes, UUIDs, file names, hashes and raw source details. It escapes text, refuses external/active image content, uses local system fonts and preserves brand proportions. Formula qualifications, source labels and the independent-project disclosure remain in exported images. All processing and downloads occur locally in the browser; the app does not publish posts or create public access to profiles. No schema changes, saved records or invitations are involved.
