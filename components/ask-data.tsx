"use client";
import { useState, useTransition, type FormEvent } from "react";
import { LoaderCircle, Send, Sparkles } from "lucide-react";
import { askTeamData } from "@/app/(workspace)/ask/actions";
import styles from "./ask-data.module.css";

const EXAMPLES = [
  "Who were our three most improved hitters by OPS from Week 2 to the BWS?",
  "Which pitchers threw the most strikes but still walked too many batters?",
  "Which position players have high bat speed but a low OPS?",
  "Summarize our team's biggest strengths and weaknesses this Fall.",
];

type Turn = { question: string; answer: string };

/** Staff-only question box over the team's saved Fall data. Answers are AI-written and kept only in this tab. */
export function AskData({ enabled }: { enabled: boolean }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = (text: string) => start(async () => {
    setError(null);
    const result = await askTeamData(text);
    if (result.ok) { setTurns(t => [{ question: text, answer: result.answer }, ...t]); setQuestion(""); }
    else setError(result.error);
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!question.trim()) { setError("Type a question first."); return; } ask(question.trim()); };
  if (!enabled) return <section className={styles.panel}><p className={styles.muted}>Ask the Data turns on once an Anthropic API key is added to the dashboard&apos;s environment.</p></section>;
  return <div className={styles.wrap}>
    <form className={styles.panel} onSubmit={submit}>
      <label htmlFor="ask-question" className={styles.label}><Sparkles size={16} aria-hidden="true"/> Ask about the team&apos;s Fall data</label>
      <div className={styles.row}>
        <textarea id="ask-question" className={styles.input} rows={2} maxLength={500} value={question} placeholder="Which hitters had the best K% this Fall?"
          onChange={e => { setQuestion(e.target.value); setError(null); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submit(e); }} disabled={pending}/>
        <button type="submit" className={styles.send} disabled={pending} aria-label="Ask">{pending ? <LoaderCircle size={18} className={styles.spin} aria-hidden="true"/> : <Send size={18} aria-hidden="true"/>}</button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!turns.length && <div className={styles.examples}>{EXAMPLES.map(text => <button key={text} type="button" onClick={() => ask(text)} disabled={pending}>{text}</button>)}</div>}
      <p className={styles.note}>Answers are written by AI from the team&apos;s saved Fall game stats and testing results. Names aren&apos;t sent; players are identified by PAC code and names are filled back in here. Double-check important numbers on the dashboard.</p>
    </form>
    {pending && <p role="status" className={styles.muted}>Reading the team data…</p>}
    {turns.map((turn, i) => <article key={turns.length - i} className={styles.turn}>
      <p className={styles.question}>{turn.question}</p>
      <div className={styles.answer}>{turn.answer.split(/\n{2,}/).map((p, j) => <p key={j}>{p}</p>)}</div>
    </article>)}
  </div>;
}
