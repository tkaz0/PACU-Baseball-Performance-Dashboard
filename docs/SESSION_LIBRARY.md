# Reviewed Full Swing sessions

Staff open **Import Center → Session Library** to see saved Full Swing sessions and Blast reports. In-Game and Practice stay separate. Blast weekly averages and weekly 95th-percentile reports remain separate reports. Original filenames, dates, included players and saved result categories are available under each card.

## Publish a session

1. Choose the Full Swing lane and correct session type, then select the original CSV.
2. Review player matches and exclude people who should not appear. Review flagged readings and remove only confirmed misreads.
3. Review pitch labels and confirm mph/feet/RPM. Unknown pitches remain unassigned and are visibly counted.
4. Review the complete preview and select **Publish Complete Session**.

The raw CSV workflow commits the numerical summaries, per-pitch maximum/average velocity and spin, exact sample counts, batted-ball charts, reviewed pitch labels and publication receipt in one database transaction. A failure rolls back every stage. An uncertain response locks the reviewed payload; an explicit retry uses the same request ID and cannot publish the session twice.

Only the exact supported Field/Live at Bat and Cage/Machine BP layouts are eligible. Machine BP is Practice hitting only. Mapped summary CSVs and Blast reports retain their separate reviewed workflows. No automatic pitch-type suggestion is accepted without staff review. Raw CSV content, export-player names and vendor IDs are not stored in the publication ledger.

## Correct and restore

An Admin outside View as can reopen the exact original CSV for a tracked publication. Previously removed source cells are loaded automatically. Review the changes, then explicitly approve replacing the saved session. All affected numerical projections are rebuilt from the reviewed original CSV together, including averages, maxima, denominators and contact/spray points. No aggregate is reconstructed from a saved maximum. The date, session type, original file fingerprint and ownership of existing source coordinates cannot change in this operation.

The Session Library offers a reviewed **Restore Previous Revision** operation for an unchanged tracked session. It restores the previous results, contacts, counts and pitch labels together and creates another revision. Corrections never change another file. Separately archived readings remain protected; external archives or label changes invalidate the session review instead of silently undoing those changes. Ordinary standalone label/removal actions now direct tracked files to the whole-session workflow. If an external database operation has already changed a tracked file, re-upload alone cannot repair it: the separate correction must be reviewed and resolved first. No automatic rebase or archive bypass is provided.

Older files show **Saved Results** with completion not tracked. Reopening an original legacy CSV may add missing outputs and establish its first tracked publication only when every existing projection agrees with the reviewed file. A conflicting legacy file is left unchanged for review. This workflow does not retroactively guess the completeness, original player exclusions or source-cell removals of older imports.

## Technical contract

Apply `202609270001_full_swing_publications.sql` before the consuming app. The normal active Admin/Coach user session calls `staff_publish_full_swing_session`; all private ledgers are closed to direct API/table access. Corrections and restore require Admin in both application and database checks. Player View stays blocked, and actual players do not receive source metadata or peer profile access.

Apply `202610040004_full_swing_publication_field_order.sql` to make the exact JSON field-name comparison independent of the database locale. In an `en_US.UTF-8` database, the prior comparison ordered `assignments` before `assignmentVersion`, rejecting valid complete sessions. The repair preserves the field whitelist, numerical checks, role checks, transaction and retry contracts. An already reviewed locked import can retry the identical payload without refreshing the page.

Publication revision, exact prior projection, expected pitch-label version and idempotent request ID guard concurrent/stale reviews. Numerical payloads use the existing canonical import, sample and contact validators. Payloads are bounded to 2,000 measurements, 500 sample rows and 500 contact rows; measurement chunks run inside the same transaction. Local tests use fictional players and cover rollback, retries, stale reviews, recomputation, access denial and exact restore. No real data is seeded by the migration.

## Retire the generic pitch label

New pitch assignments offer specific types; generic `Fastball` is no longer selectable or suggested. Speed/spin alone cannot establish a four-seam or two-seam subtype. Existing generic readings display as **Unspecified Pitch**, and existing canonical `Four-Seam Fastball` / `Two-Seam Fastball` sources display as **4-Seam Fastball** / **2-Seam Fastball**. Stored type order and source keys remain compatible with earlier files.

For older untracked files, an Admin can open **Correct CSV Assignments → Correct an Unspecified Pitch** on a profile. Select the exact original CSV, explicitly match the export pitcher, and verify all seven saved velocity/spin/count summaries. After confirming these pitches are four-seam fastballs, save the correction. This narrowly changes the selected group's type and corresponding derived-summary columns, plus only its reviewed original pitch annotations. Values, player identity, date, file fingerprint, other pitch groups and other players stay unchanged. A private before/after receipt supports **Pitch Label History → Restore Previous Pitch Labels** while the file still matches the saved correction. Concurrent changes, missing results, existing four-seam groups, archived readings and tracked publications require separate review; they are never merged or overwritten. Old generic coordinates cannot be re-imported while the correction is active. Tracked publications continue using the complete-session correction workflow.

Apply `202609280004_legacy_pitch_reclassification.sql` before this correction UI. No correction occurs when the migration runs.
