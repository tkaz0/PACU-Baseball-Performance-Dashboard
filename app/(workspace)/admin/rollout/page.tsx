import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { athleteName, type Role } from "@/lib/types";
import { PageHeading } from "@/components/page-heading";
import { CoachPreparationForm } from "@/components/coach-preparation-form";
import { prepareCoach } from "./actions";

type RolloutAthlete = {
  id: string; athlete_code: string; first_name: string; preferred_name: string | null; last_name: string; pacific_email: string | null;
  athlete_seasons: { season: string; roster_status: string | null }[];
};
type RolloutAccount = { user_id: string; is_active: boolean; account_roles: { role: Role }[]; account_athletes: { athlete_id: string }[] | { athlete_id: string } | null };
type CoachCandidate = { id: string; display_name: string; email: string; created_at: string };

export default async function RolloutPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase } = await requireAccess(["admin"]);
  const params = await searchParams;
  const [rosterResult, accountResult, coachResult] = await Promise.all([
    supabase.from("athletes").select("id,athlete_code,first_name,preferred_name,last_name,pacific_email,athlete_seasons!inner(season,roster_status)", { count: "exact" }).eq("athlete_seasons.season", "2026-27").order("last_name").order("id").limit(1000),
    supabase.from("app_accounts").select("user_id,is_active,account_roles(role),account_athletes(athlete_id)", { count: "exact" }).order("created_at").limit(1000),
    supabase.from("coach_invitation_candidates").select("id,display_name,email,created_at", { count: "exact" }).order("created_at").order("id").limit(100),
  ]);
  if (rosterResult.error || accountResult.error || coachResult.error) throw new Error("Unable to load account preparation. Check that the coach preparation migration is installed.");
  if ((rosterResult.count ?? 0) > 1000 || (accountResult.count ?? 0) > 1000 || (coachResult.count ?? 0) > 100) throw new Error("The preparation list exceeds its supported size. Ask an administrator to review it.");
  const athletes = ((rosterResult.data ?? []) as RolloutAthlete[]).filter(athlete => athlete.athlete_seasons.some(season => season.season === "2026-27"));
  const accounts = (accountResult.data ?? []) as RolloutAccount[];
  const coaches = (coachResult.data ?? []) as CoachCandidate[];
  const rows = athletes.map(athlete => {
    const linked = accounts.filter(account => (Array.isArray(account.account_athletes) ? account.account_athletes : account.account_athletes ? [account.account_athletes] : []).some(link => link.athlete_id === athlete.id));
    const connected = linked.length === 1 && linked[0].is_active && linked[0].account_roles.some(role => role.role === "player");
    const seasonal = athlete.athlete_seasons.find(season => season.season === "2026-27")!;
    const ready = !linked.length && !!athlete.pacific_email && (seasonal.roster_status === null || ["active", "redshirt"].includes(seasonal.roster_status));
    const status = connected ? "Account connected" : linked.length ? "Account needs review" : !athlete.pacific_email ? "Email needed" : ready ? "Ready to invite" : "Roster needs review";
    return { athlete, connected, ready, status };
  });

  return <>
    <PageHeading section="Administration" title="Team Account Preparation" description="Review the 2026–27 player roster and save coach details before sending invitations.">
      <Link href="/admin/access" className="btn btn-primary">Open Account access</Link>
    </PageHeading>
    {params.saved === "1" && <p className="notice notice-success mb-5" role="status">Coach details saved. Invitation not sent.</p>}
    {params.error && <p className="notice notice-error mb-5" role="alert">{params.error === "input" ? "Enter a coach name and valid email, then confirm the details." : "Coach details were not confirmed saved. Refresh the list before trying again."}</p>}
    <div className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Account preparation totals">
      {[["Current players", rows.length], ["Accounts connected", rows.filter(row => row.connected).length], ["Ready to invite", rows.filter(row => row.ready).length]].map(([label, count]) => <div className="panel p-5" key={label}><p className="muted mb-1 text-sm">{label}</p><p className="m-0 text-3xl font-bold">{count}</p></div>)}
    </div>
    <section className="panel mb-6 p-5 sm:p-6" aria-labelledby="rollout-players">
      <h2 id="rollout-players" className="mb-2 mt-0 text-xl font-bold">Players · 2026–27</h2>
      <p className="muted mb-5 text-sm">Ready means a roster email is present and no account is linked. Verify the recipient and player profile in Account access before sending. A connected account does not confirm that its password is set.</p>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-3 pr-4">Player</th><th className="py-3 pr-4">Roster email</th><th className="py-3">Account status</th></tr></thead><tbody>{rows.map(({ athlete, status }) => <tr key={athlete.id} className="border-t border-gray-200"><td className="py-4 pr-4"><Link className="font-semibold text-pacu-red" href={`/athletes/${athlete.id}`}>{athleteName(athlete)}</Link><p className="muted mb-0 mt-1 text-xs">{athlete.athlete_code}</p></td><td className="break-all py-4 pr-4">{athlete.pacific_email || "No email saved"}</td><td className="py-4">{status}</td></tr>)}</tbody></table></div> : <p className="notice">No players have a 2026–27 roster entry yet. <Link href="/admin/import" className="font-semibold underline">Import the current roster</Link> to prepare their accounts.</p>}
    </section>
    <section className="panel p-5 sm:p-6" aria-labelledby="rollout-coaches">
      <h2 id="rollout-coaches" className="mb-2 mt-0 text-xl font-bold">Coach preparation</h2>
      <p className="muted text-sm">Saving a coach stores a name and email only. Invitations are sent separately in Account access. Saving the same email updates its name.</p>
      {coaches.length ? <ul className="m-0 list-none divide-y divide-gray-200 p-0">{coaches.map(coach => <li key={coach.id} className="py-4"><p className="m-0 font-semibold">{coach.display_name}</p><p className="mb-0 mt-1 break-all text-sm">{coach.email}</p><p className="muted mb-0 mt-2 text-xs">Preparation saved · Invitation not sent from this page</p></li>)}</ul> : <p className="notice">No coach details saved yet.</p>}
      <CoachPreparationForm saveAction={prepareCoach} />
      <p className="mb-0 mt-5 text-sm"><Link href="/admin/access" className="font-semibold text-pacu-red underline">Review account access and invitations</Link></p>
    </section>
  </>;
}
