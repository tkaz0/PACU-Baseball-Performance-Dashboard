"use client";
import { useEffect } from "react";
import { PacificLogo } from "@/components/pacific-brand";
import { BaseballMark } from "@/components/baseball-mark";

const KEY = "pacu-welcome-shown";
/** Runs while the page is parsed, before paint: only a browser session's first workspace page shows the splash. */
const BOOTSTRAP = `(function(){try{if(!sessionStorage.getItem("${KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.welcome="1"}catch(e){}})()`;

/** Short branded welcome after sign-in (November 14 showcase). Decorative; click or any key skips it. */
export function WelcomeSplash() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.welcome) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* the splash simply shows again next time */ }
    const finish = () => { root.dataset.welcome = "leaving"; window.setTimeout(() => { delete root.dataset.welcome; }, 450); };
    const timer = window.setTimeout(finish, 1700);
    const skip = () => { window.clearTimeout(timer); finish(); };
    window.addEventListener("keydown", skip, { once: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", skip); };
  }, []);
  return <>
    <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP }}/>
    <div className="welcome-splash" aria-hidden="true" onClick={() => { const root = document.documentElement; root.dataset.welcome = "leaving"; window.setTimeout(() => { delete root.dataset.welcome; }, 450); }}>
      <div className="welcome-splash-inner">
        <span className="welcome-splash-ball"><BaseballMark strokeWidth={5}/></span>
        <PacificLogo className="welcome-splash-logo" decorative/>
        <p className="welcome-splash-quote"><span>People Lie,</span> <span>Numbers Don’t.</span></p>
        <p className="welcome-splash-kicker">Pacific Baseball Performance</p>
      </div>
    </div>
  </>;
}
