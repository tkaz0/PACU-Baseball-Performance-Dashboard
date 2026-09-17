"use client";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, X, ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, UserRound } from "lucide-react";
import styles from "./player-profile-guide.module.css";

export const PROFILE_GUIDE_VERSION = "pacu-profile-guide-v1";
/** A cosmetic, account-scoped browser preference. Never consulted by access checks. */
export function PlayerProfileGuide({ accountKey, autoStart = true }: { accountKey: string; autoStart?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [step, setStep] = useState(0);
  const storageKey = `${PROFILE_GUIDE_VERSION}:${accountKey}`;
  useEffect(() => {
    if (!autoStart) return;
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === "seen"; } catch { /* The guide still works when browser storage is unavailable. */ }
    if (!seen && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [storageKey, autoStart]);
  const finish = () => {
    try { localStorage.setItem(storageKey, "seen"); } catch { /* Presentation only. */ }
    trigger.current?.focus();
  };
  const move = (next: number) => { setStep(next); heading.current?.focus(); };
  return <>
    <button ref={trigger} type="button" className="btn btn-secondary" aria-label="Open profile guide" onClick={() => { setStep(0); dialog.current?.showModal(); }}><BookOpen size={16} aria-hidden="true" /><span className="hidden sm:inline">Guide</span></button>
    <dialog ref={dialog} className={styles.guide} aria-labelledby={titleId} onClose={finish}>
      <div className={styles.header}><span>Pacific Baseball</span><button type="button" className={styles.close} aria-label="Close profile guide" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></div>
      <div className={styles.body}><p className={styles.eyebrow}>Your Player Profile · {step + 1} of 3</p>
        <h2 ref={heading} tabIndex={-1} id={titleId}>{["Start With Your Overview", "Read Your Percentile Bars", "Follow Your Progress"][step]}</h2>
        {step === 0 && <><p>Your overview brings together your main measurements, game stats, and supported strengths and areas to improve.</p><div className={styles.preview}><UserRound size={26} aria-hidden="true" /><div><strong>Your profile, organized</strong><span>Overview · Physicality · In-game · Practice</span></div></div><p>In-game holds game and intrasquad results, including cumulative game stats. Practice holds practice and testing results. Hitting and pitching stay separated, and pitcher-only profiles leave out hitting measurements. Empty stats will fill in when your coaches add results.</p></>}
        {step === 1 && <><p>The number shows where a result ranks among comparable players on the team.</p><div className={styles.percentile} aria-label="Percentile color key: blue for lower ranks, red for higher ranks"><div /><span>Lower percentile</span><span>Higher percentile</span></div><p>Performance ranks follow each stat’s preferred direction. Body measurements show numerical comparisons, not a health rating.</p><p className={styles.note}>Bars appear once at least five players have comparable results. Check the sample size alongside game stats; early results can change quickly.</p></>}
        {step === 2 && <><div className={styles.tip}><CalendarDays size={22} aria-hidden="true" /><div><strong>Check Last Tested</strong><p>This is the measurement date. Game stats show when their source was last updated.</p></div></div><div className={styles.tip}><ChartNoAxesColumnIncreasing size={22} aria-hidden="true" /><div><strong>Watch Your Changes</strong><p>Repeat tests add percentage changes. Muscle mass or body score increases and body fat decreases show green; the reverse shows red. Height and weight stay neutral.</p></div></div><p>Use the little <strong>i</strong> buttons beside stats for definitions. If a result looks wrong, let your coach know.</p></>}
      </div>
      <div className={styles.footer}><div className={styles.dots} aria-label={`Step ${step + 1} of 3`}>{[0,1,2].map(i => <span key={i} data-current={step === i} />)}</div><div>{step > 0 && <button type="button" className="btn btn-secondary" onClick={() => move(step - 1)}>Back</button>}{step < 2 ? <button type="button" className="btn btn-primary" onClick={() => move(step + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" className="btn btn-primary" onClick={() => dialog.current?.close()}>Got It</button>}</div></div>
      <p className={styles.reminder}>Reopen this anytime with Guide at the top of the page. Dismissal is remembered on this browser.</p>
    </dialog>
  </>;
}
