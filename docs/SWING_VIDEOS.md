# Swing replay

Staff can select an individual batted ball on the paired contact/spray chart and attach up to four short clips. The same selection and attachments follow the ball between chart views. The expandable batted-ball table offers the same controls. Each replay card keeps that swing's date, pitch number, exit velocity, launch angle and available distance beside its clips.

Supported files are MP4, MOV and WebM, up to 50 MB each. Playback depends on the browser's codec support; MP4 works best across browsers. The coach explicitly chooses the swing and clip. There is no automatic video matching, video analysis or external sharing. Players can watch their own clips; Admin/Coach can attach or detach them. Player View is read-only.

## Storage and authorization

Apply `202609300003_swing_videos.sql` before the application. It adds a private `swing-videos` Storage bucket and a narrow metadata table. Ordinary-session RPCs recheck live staff or own-player authorization. Table access is RPC-only, upload reservations are restricted to the current staff uploader, and Storage policies reject overwriting and direct deletion. Read access requires the same current contact file/row/athlete match. Removing or reassigning the underlying contact therefore removes its old clip from player views.

A staff reservation creates a stable upload UUID and exact object path. The app uploads directly to a signed, non-upserting URL; finalization verifies a stored object's size and MIME type before making metadata visible. Retries check the same reservation before another upload and never generate a new UUID for an uncertain attempt. Session/chart/table selection stays locked until the upload is completed or cancelled. Private playback URLs expire after five minutes. No public URL, object path or signing token appears in the ordinary clip list.

Detach archives the association and records an ID-only audit event; it does not destroy the Storage object. There is no automatic retention cleanup in this release. Pending reservations expire from active limits after 24 hours, and each athlete has a bounded active attachment count. No existing measurements, classifications, identities, Auth settings or invitations change.

## Verification

Database tests cover staff-only reservation/finalization, actual storage-object evidence, metadata mismatch, idempotent retries, own-player reads, revoked/peer denial, contact reassignment, restrictive Storage guards and audited archive. Action tests cover fresh authorization and signed URL/path validation. Selection tests prevent an in-flight upload from switching swings. The PGlite harness creates an explicitly minimal Storage schema fixture; it is not a hosted Supabase Storage API test. Browser layout QA uses fictional readings. A real source clip is still required to verify its particular codec on the user's browser.
