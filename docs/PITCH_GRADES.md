# Pitch+ (Team)

`/pitch-grades` (Coaching, staff only) grades every staff-classified **in-game** pitch type, with 100 = Pacific average. It is an outcome grade built from team data, **not Stuff+**: there is no movement, release, extension or run-value model, and swing-and-miss is not recorded.

## Parts and weights

| Part | Weight | Definition | Minimum |
|---|---|---|---|
| Strike+ | 40% | Pitcher's game-sheet strike rate for the pitch family ÷ pooled team family rate × 100. Four-Seam/Two-Seam/Sinker/Cutter → fastball family; Breaking Ball/Slider/Sweeper/Curveball → breaking family; Changeup/Splitter → changeup family. Knuckleball/Other are unmapped. Pitches in one family share it. | 30+ family pitches |
| Contact+ | 40% | Average of linear lower-is-better indices of average EV, 90+ mph hard-hit rate and Squared Up against, versus every linked in-game ball against Pacific pitchers. Likely fouls are excluded. A pitch uses its own balls in play once it has 8+; until then it uses all of the pitcher's in-play balls, labeled "all pitches". | 8+ balls in play |
| Stuff-lite | 20% | 100 + 10 × z of velocity and spin among pitchers throwing the same pitch type. Changeups/splitters use their speed gap below the pitcher's main fastball, with no spin. | Staff: 3+ pitchers · Players: 5+ pitchers |

Each part is capped at 50–150. The overall Pitch+ appears only when all three parts meet their minimums; otherwise the row shows "Needs data" and lists what is missing.

## Where it appears

- **Staff:** `/pitch-grades` and a streamed card on each pitcher's Pitching tab.
- **Players and Player View:** their own Pitch+ on their Pitching tab, plus the Exit Meeting Pitch+ section and the Player Report arsenal column.

## Published team baselines (players)

Players cannot read teammates' data, so their grades use one aggregate-only row in `public.pitch_grade_baselines` (migration `202610120003_pitch_grade_baselines.sql`). The row holds:

- pooled family strike rates;
- pooled contact-against average EV, hard-hit rate and Squared Up;
- velocity, spin and speed-gap spreads (n, mean, sd) **only for pitch types with 5+ pitchers**.

`staff_save_pitch_grade_baselines` (staff only) validates the shape and rejects any spread with fewer than five pitchers. No pitcher identities or individual values are stored. Every active signed-in role may read the row.

A player's grade uses only their own arsenal, sheet counts and contact against. It applies the 5+ pitcher Stuff-lite minimum, so a pitch type with only 3–4 pitchers can show a staff grade but "Needs data" for the player. The panel shows the baseline update date.

### Refresh

Baselines are recomputed with the staff session and saved only when every pitcher's contact loaded and the values changed:

- whenever staff open Pitch Grades or a pitcher's staff Pitching card;
- after a successful Full Swing session publish (`after()` in `publishFullSwingSession`);
- after new pitcher links or Squared Up values are saved for batted balls;
- after a changed Pitching game-sheet import.

A failed refresh leaves the last published row in place.
