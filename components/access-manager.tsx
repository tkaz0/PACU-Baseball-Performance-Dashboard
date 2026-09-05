"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { UUID_PATTERN, type Role } from "@/lib/types";

export type ConfiguredAccount = { userId: string; active: boolean; roles: Role[]; athleteId: string | null };
type AccessAthlete = { id: string; code: string; name: string };
type AccessManagerProps = {
  accounts: ConfiguredAccount[]; athletes: AccessAthlete[]; currentUserId: string;
  configureAction: (form: FormData) => Promise<void>;
};
const roleOptions: { role: Role; label: string; description: string }[] = [
  { role: "admin", label: "Admin", description: "Manage account access and roster imports; view the full roster and athlete profiles." },
  { role: "coach", label: "Coach", description: "View the full roster and athlete profiles." },
  { role: "player", label: "Player", description: "View the athlete profile explicitly linked to this account." },
];
const roleText = (roles: Role[]) => roleOptions.filter(item => roles.includes(item.role)).map(item => item.label).join(" + ") || "No roles";
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function AccessManager({ accounts, athletes, currentUserId, configureAction }: AccessManagerProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState<string | null>(null);
  const athleteById = new Map(athletes.map(athlete => [athlete.id, athlete]));
  const selected = accounts.find(account => account.userId === target);
  const search = query.trim().toLocaleLowerCase("en-US");
  const visible = accounts.filter(account => {
    const athlete = account.athleteId ? athleteById.get(account.athleteId) : undefined;
    return (status === "all" || account.active === (status === "active")) &&
      `${account.userId} ${roleText(account.roles)} ${athlete?.code ?? ""} ${athlete?.name ?? ""}`.toLocaleLowerCase("en-US").includes(search);
  });

  return <>
    <div className="mb-7 grid gap-3 sm:grid-cols-3" aria-label="Account overview">
      {[{ label: "Configured accounts", value: accounts.length, icon: UsersRound },
        { label: "Active accounts", value: accounts.filter(account => account.active).length, icon: ShieldCheck },
        { label: "Disabled accounts", value: accounts.filter(account => !account.active).length, icon: UserRound }].map(({ label, value, icon: Icon }) =>
        <div key={label} className="panel flex items-center gap-4 p-5"><Icon size={22} className="text-pacu-red" aria-hidden="true" /><div><p className="muted m-0 text-xs font-semibold">{label}</p><strong className="text-2xl">{value}</strong></div></div>)}
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="panel min-w-0 p-5 sm:p-6" aria-labelledby="configured-accounts-heading">
        <div className="mb-5"><h2 id="configured-accounts-heading" className="m-0 text-lg font-bold">Configured accounts</h2><p className="muted mb-0 mt-1 text-sm">Select an account to review its saved access.</p></div>
        <label htmlFor="account-search">Search configured accounts</label>
        <div className="relative mt-2"><input id="account-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Athlete, code, role or user ID" /></div>
        <label className="mt-4" htmlFor="account-status-filter">Account status</label>
        <select id="account-status-filter" className="mt-2" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All accounts</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
        <p role="status" className="muted mb-3 mt-4 text-xs">{visible.length} of {accounts.length} configured accounts</p>
        <ul className="m-0 max-h-[38rem] list-none space-y-3 overflow-y-auto p-1" aria-label="Configured accounts">
          {visible.map(account => {
            const athlete = account.athleteId ? athleteById.get(account.athleteId) : undefined;
            const own = sameId(account.userId, currentUserId);
            return <li key={account.userId}><button type="button" aria-pressed={target === account.userId} onClick={() => setTarget(account.userId)}
              className={`w-full rounded-md border p-4 text-left ${target === account.userId ? "border-pacu-red bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <span className="flex flex-wrap items-center justify-between gap-2"><strong className="break-words text-sm">{athlete ? athlete.name : own ? "Your administrator account" : "Unlinked account"}</strong><span className={`badge ${account.active ? "badge-green" : "badge-red"}`}>{account.active ? "Active" : "Disabled"}</span></span>
              {athlete && <span className="mt-1 block text-xs font-semibold text-gray-600">{athlete.code}</span>}
              <span className="mt-3 block break-all font-mono text-xs text-gray-600">{account.userId}</span>
              <span className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">{roleText(account.roles)}</span><span className="text-xs font-semibold text-pacu-red">{own ? "Your account · Protected" : "Edit access →"}</span></span>
            </button></li>;
          })}
        </ul>
        {visible.length === 0 && <p className="muted py-4 text-sm">{accounts.length ? "No accounts match these filters." : "No configured accounts were returned."}</p>}
        <div className="mt-5 border-t border-gray-200 pt-5"><button type="button" className="btn btn-secondary w-full" onClick={() => setTarget("new")}>Configure existing user</button><p className="muted mb-0 mt-3 text-xs">For an existing Supabase Auth user whose access has not been configured yet.</p></div>
      </section>

      <section className="panel min-w-0 p-5 sm:p-6" aria-labelledby="edit-account-heading">
        <h2 id="edit-account-heading" className="mb-2 mt-0 text-lg font-bold">{selected ? "Review account access" : target === "new" ? "Configure existing user" : "Choose an account"}</h2>
        {target === null ? <div className="py-10 text-center"><ShieldCheck size={34} className="mx-auto mb-4 text-pacu-red" aria-hidden="true" /><p className="mx-auto max-w-sm text-sm text-gray-600">Choose a configured account to load its roles, status, and athlete link. Changes require your review before saving.</p></div> : <>
          <p className="muted mb-6 text-sm">{selected ? "Review the saved settings and approve any changes below." : "Use the exact user ID from Supabase → Authentication → Users. This configures access for a user who already exists."}</p>
          <form key={selected ? JSON.stringify(selected) : "new"} action={configureAction}>
            <AccountFields account={selected} accounts={accounts} athletes={athletes} currentUserId={currentUserId} onChooseAccount={setTarget} />
          </form>
        </>}
      </section>
    </div>
  </>;
}

function AccountFields({ account, accounts, athletes, currentUserId, onChooseAccount }: {
  account?: ConfiguredAccount; accounts: ConfiguredAccount[]; athletes: AccessAthlete[]; currentUserId: string;
  onChooseAccount: (id: string) => void;
}) {
  const { pending } = useFormStatus();
  const [userId, setUserId] = useState(account?.userId ?? "");
  const [roles, setRoles] = useState<Role[]>(account?.roles ?? []);
  const [active, setActive] = useState(account?.active ?? false);
  const [athleteId, setAthleteId] = useState(account?.athleteId ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const own = sameId(userId, currentUserId);
  const configuredTarget = !account ? accounts.find(item => sameId(item.userId, userId)) : undefined;
  const athlete = athletes.find(item => item.id === athleteId);
  const linkConflict = athleteId !== "" && accounts.some(item => item.athleteId === athleteId && !sameId(item.userId, userId));
  const invalidLink = athleteId !== "" && (!roles.includes("player") || linkConflict);
  const changed = !account || active !== account.active || athleteId !== (account.athleteId ?? "") || roleText(roles) !== roleText(account.roles);
  const valid = UUID_PATTERN.test(userId) && roles.length > 0 && !invalidLink && !own && !configuredTarget;
  const linkLabel = athlete ? `${athlete.code} · ${athlete.name}` : athleteId ? `Athlete ${athleteId}` : "No athlete link";

  return <fieldset disabled={pending} className="min-w-0 space-y-5 border-0 p-0">
    <label htmlFor="access-user-id">Existing Supabase Auth user ID<input id="access-user-id" name="user_id" value={userId} readOnly={!!account} required maxLength={36} pattern={UUID_PATTERN.source} autoComplete="off" autoCapitalize="none" spellCheck={false}
      aria-describedby="access-target-help" className="font-mono text-xs" placeholder="Exact Auth user UUID"
      onChange={event => { setUserId(event.target.value.trim().toLowerCase()); setConfirmed(false); }} /></label>
    <p id="access-target-help" className="muted -mt-3 text-xs">{account ? "This exact account will receive the approved changes. Select another account from the list to change the target." : "Verify this ID in Supabase before granting access. Athlete emails do not establish account ownership."}</p>
    {own && <p className="notice">Your own access is protected. Another administrator must change this account, or the owner can use the documented SQL procedure.</p>}
    {configuredTarget && !own && <div className="notice"><p className="mb-3 mt-0">This account already has configured access. Load its saved settings before editing.</p><button type="button" className="btn btn-secondary" onClick={() => onChooseAccount(configuredTarget.userId)}>Load configured account</button></div>}

    <fieldset disabled={own || !!configuredTarget} className="min-w-0 space-y-5 border-0 p-0">
      <fieldset className="min-w-0 border-0 p-0"><legend className="mb-2 text-sm font-bold">Roles</legend><p className="muted mb-3 mt-0 text-xs">Choose at least one role, including for a disabled account.</p>
        <div className="space-y-2">{roleOptions.map(({ role, label, description }) => <label key={role} className={`flex items-start gap-3 rounded-md border p-3 ${roles.includes(role) ? "border-pacu-red bg-red-50" : "border-gray-200"}`}>
          <input type="checkbox" name="roles" value={role} aria-label={label} checked={roles.includes(role)} onChange={event => { setRoles(event.target.checked ? [...roles, role] : roles.filter(item => item !== role)); setConfirmed(false); }} aria-describedby={`access-role-${role}`} />
          <span><span className="block">{label}</span><span id={`access-role-${role}`} className="mt-1 block text-xs font-normal text-gray-600">{description}</span></span>
        </label>)}</div>
        <p className="muted mb-0 mt-3 text-xs">Roles add together. Admin or Coach also grants full roster access when Player is selected.</p>
      </fieldset>

      <label htmlFor="access-athlete">Linked athlete</label><select id="access-athlete" name="athlete_id" value={athleteId} onChange={event => { setAthleteId(event.target.value); setConfirmed(false); }} aria-describedby="access-athlete-help">
        <option value="">No athlete link</option>
        {athleteId && !athlete && <option value={athleteId}>Current linked athlete · {athleteId}</option>}
        {athletes.map(item => {
          const used = accounts.some(other => other.athleteId === item.id && !sameId(other.userId, userId));
          return <option key={item.id} value={item.id} disabled={used}>{item.code} · {item.name}{used ? " · Linked to another account" : ""}</option>;
        })}
      </select>
      <p id="access-athlete-help" className="muted -mt-3 text-xs">A link requires the Player role. Select the exact athlete code and name. Choosing No athlete link removes the existing link.</p>
      {invalidLink && <p className="notice notice-error" role="alert">{linkConflict ? "This athlete is linked to another account. Choose a different athlete or No athlete link." : "Keep the Player role or choose No athlete link before saving."}</p>}
      {roles.includes("player") && !athleteId && <p className="muted text-xs">The Player role has no athlete profile to open until an athlete is linked.</p>}

      <label className="flex items-start gap-3 rounded-md border border-gray-200 p-4"><input type="checkbox" name="active" value="yes" aria-label="Account is active" checked={active} onChange={event => { setActive(event.target.checked); setConfirmed(false); }} aria-describedby="access-active-help" /><span><span className="block">Account is active</span><span id="access-active-help" className="mt-1 block text-xs font-normal text-gray-600">{active ? "This account can use its assigned access in the private workspace." : "This account is disabled. Its assigned roles and athlete link remain saved."}</span></span></label>

      <div className="rounded-md bg-gray-50 p-4"><h3 className="mb-3 mt-0 text-sm font-bold">Review change</h3><dl className="m-0 space-y-2 text-sm">
        <div><dt className="muted text-xs">Roles</dt><dd className="m-0 font-semibold">{roleText(roles)}</dd></div>
        <div><dt className="muted text-xs">Status</dt><dd className="m-0 font-semibold">{active ? "Active" : "Disabled"}</dd></div>
        <div><dt className="muted text-xs">Athlete link</dt><dd className="m-0 break-words font-semibold">{linkLabel}</dd></div>
      </dl><p className="muted mb-0 mt-3 text-xs">Saving replaces this account’s roles, status, and athlete link, and records an audit event.</p></div>
      <label className="flex items-start gap-3"><input type="checkbox" name="confirm" value="yes" required checked={confirmed} disabled={!valid || !changed} onChange={event => setConfirmed(event.target.checked)} /><span className="text-sm">I verified the Auth user ID, roles, active status, and athlete link, and approve this change.</span></label>
    </fieldset>
    <button type="submit" className="btn btn-primary w-full" disabled={pending || !valid || !changed || !confirmed}>{pending ? "Saving access…" : "Save approved access"}</button>
    {account && !changed && !own && <p className="muted m-0 text-xs">These are the saved settings. Make a change to review and save it.</p>}
  </fieldset>;
}
