# Individual account invitations

PACU team accounts are invite-only. Each recipient verifies an invitation sent to their own inbox and chooses a unique password. Public signup remains disabled; no roster import creates an Auth user, password, role, or athlete link. The invitation form and acceptance flow are implemented, with sending disabled by default. This document does not establish that hosted SMTP, invitation delivery or a real recipient's password setup has been verified.

## Prepare without sending

The Admin-only **Team account preparation** page (`/admin/rollout`) lists `2026-27` player readiness and lets an administrator save a reviewed coach name/contact email. Coach preparation requires `202609060002_coach_rollout.sql`; it upserts by normalized email and records an audit. It does not inspect/provision Auth users, grant roles, link athletes or send email.

**Ready to invite** indicates roster prerequisites, not verified inbox ownership. **Account connected** indicates an active Player role and trusted link, not a completed password. A saved coach remains a preparation record until the separately approved invitation/configuration steps succeed. The owner has explicitly said not yet to team emails. Keep sending disabled and unsent until new explicit recipient-send approval.

## Administrator flow

The private **Account access** page shows **Invite a player or coach**. Sending is available only when the server has both `SUPABASE_AUTH_ADMIN_SECRET` and `PACU_INVITATIONS_ENABLED=true`. Leave the flag false until the migration, custom sender and email templates are verified. The separate browser-local Access & views page cannot send invitations or grant accounts.

1. Sign in as an active administrator and exit any Coach/Player preview.
2. Enter one person's verified sign-in email. It may differ from their roster contact email; do not infer ownership from a roster email alone.
3. Choose Coach or Player. Coach receives full roster/profile access with no athlete link. Player requires the exact unlinked private athlete, identified by permanent code and name. Admin invitations and multiple-role invitations are not offered; use the separate existing-account editor for deliberately reviewed later changes.
4. Review the recipient, role and profile, then approve **Send approved invitation**. Editing any choice clears approval.

The action checks the administrator, validates the fields and selected profile, and inspects the Auth directory before sending. Existing Auth users require reviewed account configuration/password recovery; they are not reinvited. An unavailable or incomplete directory check fails closed. A fresh administrator check immediately precedes the email operation.

After Supabase returns the invited user's Auth UUID, the action calls `admin_provision_invited_account` with the normal administrator session. The RPC requires a new application account, exactly one Coach or Player role, and the matching link rules. It shares the existing account lock, rechecks active admin access after waiting, and saves active status, role, link and audit atomically. Existing accounts, including disabled accounts, cannot be overwritten by this path.

Delivery and account configuration are separate outcomes. A timeout may mean an email was sent; inspect Supabase Auth and provider records before retrying. If the invitation succeeded but access setup is unconfirmed, review that exact Auth user and use **Configure existing user**. Do not automatically resend, delete the user, or replace an existing role/link. The form reports these partial outcomes without returning private provider responses or recipient tokens.

## Recipient flow

1. Open the invitation email and select **Continue account setup**.
2. The app shows **Accept your invitation**. Opening the link alone does not consume it; the recipient must select **Continue account setup** on that page.
3. The server verifies this exact one-time token as an `invite` with Supabase. A valid invitation creates an authenticated session for the invited account and opens the password form at the fixed `/reset-password?setup=invite` destination.
4. Choose and confirm a password of 6–128 characters. No year, suffix or character mix is required. The existing password action updates that authenticated account, requests global session sign-out, and directs the recipient to sign in using their new password.

Account permissions remain separate. An administrator must approve the recipient’s roles, active status, and exact athlete profile link through the existing audited account configuration. Invitation acceptance does not assign or increase permissions. An unconfigured or disabled account cannot read protected athlete data. Players see only their explicitly linked private profile; coaches can view the team roster.

The existing password recovery flow remains available. Its confirmation type is `recovery`, and its destination remains `/reset-password`. The confirmation handler accepts only `invite` and `recovery`; signup, magic-link, arbitrary types, and external redirect destinations are not accepted. Expired or already-used invitations show **Invitation unavailable**, with links to sign in or request password recovery and instructions to contact the administrator.

## Email template and sender setup

Use [the invitation template](../supabase/templates/invite.html) for Supabase’s **Invite user** email. Its link is:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Continue account setup</a>
```

The hosted Site URL must be the verified production origin, `https://pacubaseballperformance.com`; retain its exact approved authentication redirect URLs. The template uses the fixed Site URL rather than an arbitrary submitted redirect. For local Supabase, configure `[auth.email.template.invite]` with this HTML file and a local Site URL. Installing a local template does not update hosted Auth settings.

Supabase’s default sender restricts recipients to organization members and is unsuitable for team invitations. Configure and verify an owned sending domain with a custom SMTP provider, disable click tracking that rewrites Auth links, and verify delivery to an owner-controlled inbox before inviting the team. See [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp) and [Supabase’s token-hash invitation guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

Invitations may also be issued from Supabase's dashboard for a deliberately selected recipient. This provides a way to verify the template/password flow while app invitation sending is still disabled. Supabase Auth administration requires a secret on a trusted server; it is not the client's publishable key or the administrator's ordinary account role. See [Auth admin requirements](https://supabase.com/docs/reference/javascript/auth-admin).

## Server configuration and staged rollout

Normal app data access still uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the signed-in user's session. The optional `SUPABASE_AUTH_ADMIN_SECRET` belongs to that same Supabase project and is read only by `lib/supabase/auth-admin.ts`, marked `server-only`. Its returned Auth interface is used only for directory lookup and `inviteUserByEmail`; it is never used for table reads/writes or the provisioning RPC. Store it privately in the server environment, with no `NEXT_PUBLIC_` prefix, client serialization, logging or source-control entry. Keep SMTP credentials separately in the provider/Supabase settings.

Fresh databases apply all tracked migrations in order. Existing databases apply only unapplied files after verifying migration history. Invitation provisioning uses `202609050003_invited_account_provisioning.sql`; shared performance and coach preparation have their own subsequent migrations. Do not replay the original schema, bootstrap another first administrator, or reimport fictional athletes to enable invitations.

Keep `PACU_INVITATIONS_ENABLED=false` while setting up the migration, sender, Site URL and templates. Verify a deliberately approved recipient's invitation, password creation and fresh login using local Supabase/Mailpit first, then the intended hosted environment. Only after those checks set the flag to `true` with the server-only secret and restart/redeploy. Keep other environments disabled and never give a production Auth administrator secret to a Preview deployment. Setting the flag back to false blocks new app sends but does not disable existing accounts.

## Data and verification limits

Separate logins use the protected Supabase workspace. Invitation acceptance does not transfer browser-local roster or RENPHO data. Import the private roster and explicitly approve the numerical **Shared measurements** workflow after applying its migration; see [PLAYER_PROFILES](PLAYER_PROFILES.md). Do not distribute a complete browser backup to give players their own accounts.

Focused tests use fictional tokens and mocked Auth responses for confirmation and invitation actions. Embedded PostgreSQL tests execute the new RPC with separate fictional subjects and verify role/link constraints, existing-account preservation, rollback, grants and lock order. They do not prove email delivery, actual concurrent hosted transactions, or a completed hosted invitation/password cycle. Verify those separately with an explicitly approved recipient, keeping tokens and passwords out of logs, screenshots, source, and reports. See [TESTING](TESTING.md).
