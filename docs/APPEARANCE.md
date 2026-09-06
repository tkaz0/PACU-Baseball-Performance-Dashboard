# Dashboard Appearance

Every active dashboard role can choose **Light**, **Dark**, or **System** in the header or Settings. The authentication frame also offers the same cosmetic control. System is the default and follows the device's color preference, including changes while the page is open. Explicit Light or Dark choices stay fixed until changed.

The preference lives in this browser's `pacu-appearance-v1` localStorage entry. It is not an account setting and does not grant access, change roles, or contain roster data. Changes sync to other tabs of the same site. If storage is blocked, the selection applies to the current page; Settings explains that it may not survive a reload.

A fixed inline script in the root document validates the stored choice and sets `data-theme` before content paints. The React provider then handles controls, device changes, and storage events. Only `light`, `dark`, and `system` are recognized. The script never evaluates or interpolates storage contents. If a stricter Content Security Policy is introduced, authorize this fixed script with the application's nonce or hash rather than removing the pre-paint step.

Shared CSS variables name page/panel/raised/input surfaces, primary/secondary text, subtle borders, and readable accents. Dark rules cover existing profile utility colors, forms, administration tables, chart axes, percentage tracks, status notices, and authentication pages. The official Pacific brand files and uploaded source images retain their original colors; no image inversion is applied.

Validation covers unsupported preferences, unavailable storage, before-hydration theme selection, device changes, explicit overrides, reload persistence, cross-tab updates, and desktop/mobile visual readability with fictional fixtures.
