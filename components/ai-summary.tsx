"use client";
import { useState, useTransition } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import { writePlayerSummary } from "@/app/(workspace)/athletes/[id]/summary-actions";
import styles from "./ai-summary.module.css";

/** Staff-only card: an AI-written draft of the player's Fall, generated on request and never saved. */
export function AiSummary({ athleteId, enabled }: { athleteId: string; enabled: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    const result = await writePlayerSummary(athleteId);
    if (result.ok) setText(result.text); else setError(result.error);
  });
  return <section className={styles.card} aria-label="AI summary" data-testid="ai-summary">
    <header className={styles.head}>
      <span className={styles.title}><Sparkles size={16} aria-hidden="true"/> AI Summary</span>
      <span className={styles.badge}>Staff only · draft</span>
      {enabled && <button type="button" className={styles.button} onClick={run} disabled={pending}>
        {pending ? <><LoaderCircle size={15} className={styles.spin} aria-hidden="true"/> Writing…</> : text ? "Rewrite" : "Write summary"}
      </button>}
    </header>
    {!enabled && <p className={styles.muted}>AI summaries turn on once an Anthropic API key is added to the dashboard.</p>}
    {enabled && !text && !error && !pending && <p className={styles.muted}>Get a short written recap of this player&apos;s Fall from the numbers on this profile.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {text && <div className={styles.text}>{text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
    {text && <p className={styles.note}>Written by AI from this player&apos;s saved numbers (no name is sent). Check it against the profile before sharing.</p>}
  </section>;
}
