import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { AccessManager, type ConfiguredAccount } from "@/components/access-manager";
import { athleteName, type Athlete, type Role } from "@/lib/types";
import { InviteAccountForm } from "@/components/invite-account-form";
import { invitationsEnabled } from "@/lib/supabase/auth-admin";
import { inviteAccount } from "./invite-actions";
import { configureAccount } from "./actions";

type AccountRow = {
  user_id: string; is_active: boolean; account_roles: { role: Role }[];
  account_athletes: { athlete_id: string } | { athlete_id: string }[] | null;
};

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; invite?: string }> }) {
  const { supabase, user } = await requireAccess(["admin"]);
  const params = await searchParams;
  const [accountResult, athleteResult] = await Promise.all([
    supabase.from("app_accounts").select("user_id,is_active,account_roles(role),account_athletes(athlete_id)").order("created_at"),
    supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season)").eq("athlete_seasons.season", "2026-27").order("last_name").limit(1000),
  ]);
  if (accountResult.error || athleteResult.error) throw new Error("Unable to load account access.");
  const accounts: ConfiguredAccount[] = ((accountResult.data ?? []) as AccountRow[]).map(account => {
    const link = Array.isArray(account.account_athletes) ? account.account_athletes[0] : account.account_athletes;
    return { userId: account.user_id, active: account.is_active, roles: account.account_roles.map(item => item.role), athleteId: link?.athlete_id ?? null };
  });
  const athletes = ((athleteResult.data ?? []) as Pick<Athlete, "id" | "athlete_code" | "first_name" | "preferred_name" | "last_name">[])
    .map(athlete => ({ id: athlete.id, code: athlete.athlete_code, name: athleteName(athlete) }));

  const invitationNotices: Record<string, string> = {
    sent: "Invitation sent and access configured. The recipient can open the email and choose their own password.",
    input: "Enter a valid email, choose Coach or Player, select the exact player profile when needed, and approve the invitation.",
    setup: "Email invitations are not enabled yet. Sender verification and server setup must be completed first.",
    athlete: "No invitation was sent. That player profile is unavailable or already linked to an account. Refresh and review the selection.",
    existing: "This email already has an Auth account. No invitation was sent or access changed. Review its configured access and use Forgot password if needed.",
    unavailable: "The account directory could not be verified. No invitation was sent. Try again after the service is available.",
    delivery: "The email provider did not confirm this invitation. It may have been sent. Check Supabase Authentication and the email log before trying again.",
    review: "The invitation was sent, but access setup was not confirmed. Review this user in Supabase Authentication, then use Configure existing user below. Do not send another invitation.",
  };
  return <>
    <PageHeading section="Administration" title="Account access" description="Review who can use the private workspace, choose their roles, and connect players to the correct athlete profile." />
    {params.error && <p role="alert" className="notice notice-error mb-6">{params.error === "input"
      ? "Enter a valid Auth user ID, choose at least one role, and confirm the change."
      : "Access was not changed. Confirm that the Auth user exists, the athlete is not linked elsewhere, and you are not changing your own account."}</p>}
    {params.saved && <p role="status" className="notice notice-success mb-6">Account access saved and audited.</p>}
    {params.invite && Object.hasOwn(invitationNotices, params.invite) && <p role={params.invite === "sent" ? "status" : "alert"} className={`notice mb-6 ${params.invite === "sent" ? "notice-success" : "notice-error"}`}>{invitationNotices[params.invite]}</p>}
    <InviteAccountForm enabled={invitationsEnabled()} athletes={athletes.filter(athlete => !accounts.some(account => account.athleteId === athlete.id))} inviteAction={inviteAccount} />
    <AccessManager accounts={accounts} athletes={athletes} currentUserId={user.id} configureAction={configureAccount} />
  </>;
}
