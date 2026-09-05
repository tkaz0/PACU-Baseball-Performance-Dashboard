"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth";
import { createAuthAdministrator, invitationsEnabled } from "@/lib/supabase/auth-admin";
import { emailIsNew, parseInvitation } from "@/lib/account-invitation";
import { appUrl } from "@/lib/env";
import { UUID_PATTERN } from "@/lib/types";

export async function inviteAccount(form: FormData) {
  const { supabase } = await requireAdminMutation();
  const invitation = parseInvitation(form);
  if (!invitation) redirect("/admin/access?invite=input");
  if (!invitationsEnabled()) redirect("/admin/access?invite=setup");
  if (invitation.athleteId) {
    const [athlete, link] = await Promise.all([
      supabase.from("athletes").select("id").eq("id", invitation.athleteId).maybeSingle(),
      supabase.from("account_athletes").select("user_id").eq("athlete_id", invitation.athleteId).maybeSingle(),
    ]);
    if (athlete.error || link.error || !athlete.data || link.data) redirect("/admin/access?invite=athlete");
  }
  const administrator = createAuthAdministrator();
  let directory: "new" | "existing" | "unavailable" = "unavailable";
  try { directory = await emailIsNew(invitation.email, page => administrator.listUsers({ page, perPage: 100 })); }
  catch { /* Do not expose Auth responses or recipient addresses. */ }
  if (directory !== "new") redirect(`/admin/access?invite=${directory}`);
  // Recheck the live actor immediately before the external email side effect.
  const current = await requireAdminMutation();
  let invitedId: string | null = null;
  try {
    const { data, error } = await administrator.inviteUserByEmail(invitation.email, {
      redirectTo: `${appUrl()}/auth/confirm`,
    });
    if (!error && data.user && UUID_PATTERN.test(data.user.id) && data.user.email?.toLowerCase() === invitation.email) invitedId = data.user.id;
  } catch { /* A timeout may mean an email was sent. Never automatically retry. */ }
  if (!invitedId) redirect("/admin/access?invite=delivery");
  let configured = false;
  try {
    const { error } = await current.supabase.rpc("admin_provision_invited_account", {
      target_user: invitedId, account_role: invitation.role, linked_athlete: invitation.athleteId,
    });
    configured = !error;
  } catch { /* A partial result needs an administrator's review, not a resend. */ }
  revalidatePath("/admin/access");
  redirect(`/admin/access?invite=${configured ? "sent" : "review"}`);
}
