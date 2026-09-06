"use client";

import { useId } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useAppearance } from "@/components/appearance-provider";
import { appearancePreference } from "@/lib/appearance";

export function AppearanceControl() {
  const id = useId();
  const { preference, resolved, setPreference } = useAppearance();
  const Icon = preference === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  return <div className="appearance-control"><Icon size={15} aria-hidden="true" /><label htmlFor={id} className="sr-only">Appearance</label><select id={id} value={preference} onChange={event => setPreference(appearancePreference(event.target.value))}>
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select></div>;
}
