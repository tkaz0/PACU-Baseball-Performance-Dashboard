# Pacific Baseball Branding

This independently owned dashboard uses Pacific University identity assets at the owner's request. It remains labelled as an independent project, not an official university application. The app does not claim university endorsement.

## Source assets

The following files were retrieved unchanged from official Pacific University sites on September 5, 2026:

| Local file | Official source | Use |
| --- | --- | --- |
| `public/brand/pacific-athletics-p.png` | [Pacific Athletics header logo](https://goboxers.com/images/assets/logo.png), displayed on the [official baseball site](https://goboxers.com/sports/baseball) | Small athletics mark on navigation and profiles |
| `public/brand/pacific-university.svg` | [Pacific University site logo](https://www.pacificu.edu/themes/custom/pacific2023/logo.svg) | Full logo on light backgrounds |
| `public/brand/pacific-university-white.svg` | [Pacific University footer logo](https://www.pacificu.edu/themes/custom/pacific2023/images/logo-white.svg) | Full logo on the dark authentication frame |

These are existing source assets, not generated or traced replacements. Keep the original proportions, colors and internal arrangement. Do not crop, recolor, stretch or add effects. The athletics PNG is 88 × 119 pixels; display it at a small size. The full university marks are scalable SVGs. Descriptive app text is separate from the marks.

Pacific's [brand guidance](https://www.pacificu.edu/directory/university-advancement/marketing-communications/pacific-university-brand) and [brand standards](https://www.pacificu.edu/sites/default/files/documents/BrandStandards_0.pdf) describe brand use, logo integrity and restrictions on implied endorsement. Source availability is not a claim of a new license or university approval.

## Presentation

- Pacific red, charcoal, white and quiet gray support readable tables and controls.
- Use title case for page titles, section titles, navigation and field labels. Use sentence case for explanatory copy. Keep official logo lettering unchanged.
- The landing quote is exactly **People Lie, Numbers Don’t.** It is the owner's requested dashboard statement, not presented as a university slogan.
- Authentication pages have no public dashboard or browser workspace entry. Authorized access and admin import tools are enforced separately by the application.
- `PacificBrand` provides the athletics mark and separate app descriptor. `PacificLogo` provides a single source mark, with optional decorative alt text when nearby text already names Pacific.

No external image request is required to display the brand assets; they are served from this deployment.

## September 19 visual refresh

The complete official Boxer/dragon university mark now appears on the roster header and sidebar, with more room on the sign-in screen. The athletics P remains the home-navigation and player-profile mark. Artwork is unchanged. The shared presentation stylesheet uses Boxer Red (#B51217), charcoal identity cards, consistent rounded panels, restrained table dividers, and explicit light/dark tokens. Main headings have a small red rule; profile tabs stay on one row on narrow phones. In-Game is consistently capitalized as a navigation label. Keep the independent-project disclosure alongside the branded workspace.

## Browser tab icon

At the owner’s request, `app/icon.svg` uses the complete Boxer dragon portion of the existing university SVG without its wordmark. This icon-specific separation preserves all eleven dragon paths, their proportions and original red. A white rounded background keeps it visible in light and dark browser tabs. The full source logos remain unchanged. Next.js generates the icon metadata and versioned URL.
