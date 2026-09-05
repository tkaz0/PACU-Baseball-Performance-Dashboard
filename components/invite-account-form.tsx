"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { MailPlus } from "lucide-react";

type InviteAthlete = { id: string; code: string; name: string };
type InviteAccountFormProps = {
  enabled: boolean;
  athletes: InviteAthlete[];
  inviteAction: (form: FormData) => Promise<void>;
};

export function InviteAccountForm({ enabled, athletes, inviteAction }: InviteAccountFormProps) {
  return <section className="panel mb-7 min-w-0 p-5 sm:p-6" aria-labelledby="invite-account-heading">
    <div className="mb-5 flex items-start gap-3">
      <MailPlus size={23} className="mt-1 shrink-0 text-pacu-red" aria-hidden="true" />
      <div>
        <h2 id="invite-account-heading" className="m-0 text-lg font-bold">Invite a player or coach</h2>
        <p className="muted mb-0 mt-1 text-sm">Send one person an email to choose their own password. Review their access before sending.</p>
      </div>
    </div>
    {enabled ? <form action={inviteAction}><InviteFields athletes={athletes} /></form> :
      <p className="notice mb-0" role="status">Email invitations are being set up. Sending will be available here once the email service is ready.</p>}
  </section>;
}

function InviteFields({ athletes }: { athletes: InviteAthlete[] }) {
  const { pending } = useFormStatus();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"player" | "coach">("player");
  const [athleteId, setAthleteId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const athlete = athletes.find(item => item.id === athleteId);
  const recipient = email.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) && recipient.length <= 254 && (role === "coach" || !!athlete);

  return <fieldset disabled={pending} className="min-w-0 space-y-5 border-0 p-0">
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <label htmlFor="invite-email">Sign-in email
          <input id="invite-email" name="email" type="email" value={email} required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="invite-email-help"
            onChange={event => { setEmail(event.target.value); setConfirmed(false); }} />
        </label>
        <p id="invite-email-help" className="muted -mt-3 text-xs">Use an address this person can open. It may differ from their roster email; you must verify the recipient and choose the correct player profile.</p>

        <label htmlFor="invite-role">Account access
          <select id="invite-role" name="role" value={role} aria-describedby="invite-role-help" onChange={event => {
            setRole(event.target.value === "coach" ? "coach" : "player");
            setAthleteId("");
            setConfirmed(false);
          }}>
            <option value="player">Player</option>
            <option value="coach">Coach</option>
          </select>
        </label>
        <p id="invite-role-help" className="muted -mt-3 text-xs">{role === "player" ? "Players can view only the profile you link to their account." : "Coaches can view the full roster and athlete profiles."}</p>

        {role === "player" ? <>
          <label htmlFor="invite-athlete">Player profile
            <select id="invite-athlete" name="athlete_id" value={athleteId} required aria-describedby="invite-athlete-help" onChange={event => { setAthleteId(event.target.value); setConfirmed(false); }}>
              <option value="">Choose the exact player</option>
              {athletes.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
          <p id="invite-athlete-help" className="muted -mt-3 text-xs">Only profiles without an account link are listed. Check both the permanent code and player name.</p>
          {athletes.length === 0 && <p className="notice">No unlinked player profiles are available. Import the roster or review existing account links before inviting a player.</p>}
        </> : <input type="hidden" name="athlete_id" value="" />}
      </div>

      <div className="min-w-0 rounded-md bg-gray-50 p-4 sm:p-5">
        <h3 className="mb-4 mt-0 text-sm font-bold">Review invitation</h3>
        <dl className="m-0 space-y-4 text-sm">
          <div><dt className="muted text-xs">Send to</dt><dd className="m-0 break-all font-semibold">{recipient || "Enter their sign-in email"}</dd></div>
          <div><dt className="muted text-xs">Access</dt><dd className="m-0 font-semibold">{role === "player" ? "Player · Own linked profile" : "Coach · Full roster and profiles"}</dd></div>
          <div><dt className="muted text-xs">Player profile</dt><dd className="m-0 break-words font-semibold">{role === "coach" ? "No player link" : athlete ? `${athlete.code} · ${athlete.name}` : "Choose a player before sending"}</dd></div>
        </dl>
        <p className="muted mb-0 mt-5 border-t border-gray-200 pt-4 text-xs">The recipient follows the email link and creates a private password. You manage their access from this page.</p>
      </div>
    </div>

    <label className="flex items-start gap-3">
      <input type="checkbox" name="confirm" value="yes" checked={confirmed} required disabled={!valid} onChange={event => setConfirmed(event.target.checked)} />
      <span className="text-sm">I verified this email address, access level, and player profile, and approve sending this invitation.</span>
    </label>
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || !valid || !confirmed}>{pending ? "Sending invitation…" : "Send approved invitation"}</button>
    <p className="muted mb-0 text-xs">Invitations give access to the private workspace. Data saved only in the browser workspace stays in that browser.</p>
  </fieldset>;
}
