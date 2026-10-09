"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import styles from "./player-report.module.css";

export const REPORT_BLOCKS = [
  { key: "percentiles", label: "Top percentiles" }, { key: "testing", label: "Testing results" }, { key: "blast", label: "Blast averages" },
  { key: "games", label: "Game stats" }, { key: "arsenal", label: "Pitch arsenal" }, { key: "note", label: "Scout's Take" },
] as const;
const STORAGE_KEY = "pacu-report-hidden-blocks";

const EVENT = "pacu-report-blocks";
function readHidden(): string {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(saved) ? saved.filter(key => REPORT_BLOCKS.some(block => block.key === key)).join(" ") : ""; } catch { return ""; }
}
const subscribe = (callback: () => void) => { window.addEventListener(EVENT, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(EVENT, callback); window.removeEventListener("storage", callback); }; };

/** Browser-local layout choice only; it never changes records or what the viewer is allowed to see. */
export function ReportCustomizer({ children }: { children: ReactNode }) {
  const saved = useSyncExternalStore(subscribe, readHidden, () => "");
  const [fallback, setFallback] = useState<string | null>(null);
  const hidden = (fallback ?? saved).split(" ").filter(Boolean);
  const toggle = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter(item => item !== key) : [...hidden, key];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); window.dispatchEvent(new Event(EVENT)); setFallback(null); } catch { setFallback(next.join(" ")); }
  };
  return <>
    <fieldset className={`${styles.customize} no-print`} data-testid="report-customizer">
      <legend>Include on the report</legend>
      {REPORT_BLOCKS.map(block => <label key={block.key}><input type="checkbox" checked={!hidden.includes(block.key)} onChange={() => toggle(block.key)}/>{block.label}</label>)}
      <small>Saved in this browser for your next report.</small>
    </fieldset>
    <div className={styles.customizer} data-hide={hidden.join(" ")}>{children}</div>
  </>;
}

/** Typed on screen, printed with the report, never saved or sent anywhere. Empty notes do not print. */
export function ScoutsTake() {
  const [text, setText] = useState("");
  return <section data-block="note" className={styles.note} data-empty={!text.trim() || undefined} aria-label="Scout's Take">
    <h2>Scout&apos;s Take</h2>
    <textarea className="no-print" value={text} maxLength={600} rows={3} placeholder="Add a short coaching summary for this printout (not saved)." onChange={event => setText(event.target.value)}/>
    <p className={styles.notePrint}>{text}</p>
  </section>;
}
