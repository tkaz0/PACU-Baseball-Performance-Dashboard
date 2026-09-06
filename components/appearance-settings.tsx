"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";

const choices = [
  { value: "light", label: "Light", description: "Bright surfaces and dark text.", icon: Sun },
  { value: "dark", label: "Dark", description: "Dark surfaces with softer contrast.", icon: Moon },
  { value: "system", label: "System", description: "Follow your device’s appearance.", icon: Monitor },
] as const;

export function AppearanceSettings() {
  const { preference, resolved, setPreference, storageUnavailable } = useAppearance();
  return <section className="panel appearance-settings" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Appearance</h2><p className="muted">Choose how your dashboard looks. This preference is saved in this browser.</p>
    <fieldset className="appearance-choices"><legend className="sr-only">Dashboard appearance</legend>{choices.map(({ value, label, description, icon: Icon }) => <label key={value} className="appearance-choice" data-selected={preference === value}>
      <input type="radio" name="appearance-preference" value={value} checked={preference === value} onChange={() => setPreference(value)} />
      <span className={`appearance-swatch appearance-swatch-${value}`} aria-hidden="true"><span /><span /><span /></span>
      <span className="appearance-choice-name"><Icon size={17} aria-hidden="true" />{label}</span><span className="appearance-choice-description">{description}</span>
    </label>)}</fieldset>
    <p className="appearance-status" role="status">{preference === "system" ? `Following your device: ${resolved === "dark" ? "Dark" : "Light"}.` : `${resolved === "dark" ? "Dark" : "Light"} appearance is selected.`}</p>
    {storageUnavailable && <p className="notice" role="alert">Your choice applies now, but this browser could not save it. You may need to choose it again after reloading.</p>}
  </section>;
}
