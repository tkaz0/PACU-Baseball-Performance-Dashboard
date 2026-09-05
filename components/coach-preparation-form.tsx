"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function Fields() {
  const { pending } = useFormStatus();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const valid = !!name.trim() && name.trim().length <= 160 && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return <fieldset disabled={pending} className="min-w-0 space-y-4 border-0 p-0">
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor="coach-name">Coach name<input id="coach-name" name="display_name" value={name} maxLength={160} required autoComplete="off" onChange={event => { setName(event.target.value); setConfirmed(false); }} /></label>
      <label htmlFor="coach-email">Coach email<input id="coach-email" name="email" type="email" value={email} maxLength={254} required autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => { setEmail(event.target.value); setConfirmed(false); }} /></label>
    </div>
    <div className="rounded-md bg-gray-50 p-4 text-sm" aria-live="polite">
      <p className="m-0 font-semibold">{name.trim() || "Enter coach name"}</p>
      <p className="mb-0 mt-1 break-all">{email.trim().toLowerCase() || "Enter coach email"}</p>
      <p className="muted mb-0 mt-3">Invitation not sent. Save these details for review in Account access.</p>
    </div>
    <label className="flex items-start gap-3"><input type="checkbox" name="confirm" value="yes" checked={confirmed} required disabled={!valid} onChange={event => setConfirmed(event.target.checked)} /><span className="text-sm">I reviewed this coach name and email address.</span></label>
    <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || !valid || !confirmed}>{pending ? "Saving coach…" : "Save coach details"}</button>
  </fieldset>;
}

export function CoachPreparationForm({ saveAction }: { saveAction: (form: FormData) => Promise<void> }) {
  return <form action={saveAction} className="mt-5"><Fields /></form>;
}
