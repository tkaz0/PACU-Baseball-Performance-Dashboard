import { requireAccess } from "@/lib/auth";
import { PageHeading } from "@/components/page-heading";
import { AccessManager, type ConfiguredAccount } from "@/components/access-manager";
import { athleteName, type Athlete, type Role } from "@/lib/types";
import { configureAccount } from "./actions";

type AccountRow = {
  user_id: string; is_active: boolean; account_roles: { role: Role }[];
  account_athletes: { athlete_id: string } | { athlete_id: string }[] | null;
};

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase, user } = await requireAccess(["admin"]);
  const params = await searchParams;
  const [accountResult, athleteResult] = await Promise.all([
    supabase.from("app_accounts").select("user_id,is_active,account_roles(role),account_athletes(athlete_id)").order("created_at"),
    supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name").order("last_name").limit(1000),
  ]);
  if (accountResult.error || athleteResult.error) throw new Error("Unable to load account access.");
  const accounts: ConfiguredAccount[] = ((accountResult.data ?? []) as AccountRow[]).map(account => {
    const link = Array.isArray(account.account_athletes) ? account.account_athletes[0] : account.account_athletes;
    return { userId: account.user_id, active: account.is_active, roles: account.account_roles.map(item => item.role), athleteId: link?.athlete_id ?? null };
  });
  const athletes = ((athleteResult.data ?? []) as Pick<Athlete, "id" | "athlete_code" | "first_name" | "preferred_name" | "last_name">[])
    .map(athlete => ({ id: athlete.id, code: athlete.athlete_code, name: athleteName(athlete) }));

  return <>
    <PageHeading section="Administration" title="Account access" description="Review who can use the private workspace, choose their roles, and connect players to the correct athlete profile." />
    {params.error && <p role="alert" className="notice notice-error mb-6">{params.error === "input"
      ? "Enter a valid Auth user ID, choose at least one role, and confirm the change."
      : "Access was not changed. Confirm that the Auth user exists, the athlete is not linked elsewhere, and you are not changing your own account."}</p>}
    {params.saved && <p role="status" className="notice notice-success mb-6">Account access saved and audited.</p>}
    <AccessManager accounts={accounts} athletes={athletes} currentUserId={user.id} configureAction={configureAccount} />
  </>;
}
