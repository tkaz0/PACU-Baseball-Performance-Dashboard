"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordSetupField({ name, label }: { name: "password" | "confirm"; label: string }) {
  const [visible, setVisible] = useState(false);
  const id = `setup-${name}`;
  return <div>
    <label htmlFor={id}>{label}</label>
    <div className="relative mt-2">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete="new-password"
        minLength={6} maxLength={128} required className="pr-24" autoCapitalize="none" spellCheck={false} />
      <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-controls={id} aria-pressed={visible}
        onClick={() => setVisible(value => !value)}
        className="absolute inset-y-1 right-1 flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pacu-red">
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  </div>;
}
