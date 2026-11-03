"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Printer, RotateCcw } from "lucide-react";
import { ExitMeetingHandout } from "@/components/exit-meeting-handout";
import { HandoutFit } from "@/components/exit-meeting-handout-fit";
import type { ExitMeetingReport } from "@/lib/exit-meeting";
import type { BwsAward } from "@/lib/game-weeks-server";
import page from "./exit-meeting.module.css";
import sheet from "./exit-meeting-handout.module.css";

type Loaded = { report: ExitMeetingReport; headshot: string | null; awards: BwsAward[] };
type Slot = { status: "waiting" | "loading" | "ready" | "failed"; data?: Loaded; error?: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const CONCURRENCY = 2, TRIES = 3;

async function loadOne(id: string): Promise<Loaded> {
  let last = "This handout could not be loaded.";
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      const response = await fetch(`/exit-meetings/report?athlete=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.report) return body as Loaded;
      last = typeof body?.error === "string" ? body.error : last;
      if (response.status === 400 || response.status === 403 || response.status === 404) break;
    } catch { /* network hiccup: retry */ }
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(last);
}

/**
 * Loads every current player's handout (two at a time, with retries), then prints them as one job so the
 * browser can save a single PDF. Each handout is two pages, so double-sided printing keeps players apart.
 * Talking points stay blank writing lines; nothing is saved.
 */
export function ExitMeetingPrintAll({ players }: { players: { id: string; name: string }[] }) {
  const [slots, setSlots] = useState<Record<string, Slot>>(() => Object.fromEntries(players.map(p => [p.id, { status: "waiting" } as Slot])));
  const [meetingDate, setMeetingDate] = useState(today);
  const started = useRef(false);
  const run = useCallback(async (ids: string[]) => {
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        setSlots(s => ({ ...s, [id!]: { status: "loading" } }));
        try { const data = await loadOne(id); setSlots(s => ({ ...s, [id!]: { status: "ready", data } })); }
        catch (error) { setSlots(s => ({ ...s, [id!]: { status: "failed", error: error instanceof Error ? error.message : "Could not load." } })); }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }, []);
  useEffect(() => { if (!started.current) { started.current = true; void run(players.map(p => p.id)); } }, [players, run]);

  const ready = players.filter(p => slots[p.id]?.status === "ready"), failed = players.filter(p => slots[p.id]?.status === "failed");
  const done = ready.length + failed.length === players.length;
  const pct = players.length ? Math.round((ready.length + failed.length) / players.length * 100) : 100;
  return <div className={page.workspace}>
    <header className={page.hero}><div><span className={page.eyebrow}>COACHING / EXIT MEETINGS</span><h1>Print All Handouts</h1><p>Every current player&apos;s front-and-back handout in one print job. Choose “Save as PDF” to download a single file.</p></div></header>
    <section className={page.setup} style={{ position: "static" }} aria-label="Print all controls">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "end" }}>
        <label className={page.selectLabel} style={{ marginTop: 0 }}>Meeting Date<input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)}/></label>
        <button className={page.download} style={{ width: "auto", padding: "13px 22px" }} disabled={!ready.length || !done} onClick={() => window.print()}><Printer size={18}/> Print / Save as PDF ({ready.length} players)</button>
        {failed.length > 0 && done && <button className={page.download} style={{ width: "auto", padding: "13px 22px", background: "#5b6270" }} onClick={() => run(failed.map(p => p.id))}><RotateCcw size={16}/> Retry {failed.length} failed</button>}
        <Link href="/exit-meetings" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 700 }}><ArrowLeft size={14}/> One player</Link>
      </div>
      <div role="status" style={{ marginTop: 16, fontSize: 13 }}>
        {done ? <strong>{failed.length ? `${ready.length} of ${players.length} handouts ready. ${failed.length} could not load: ${failed.map(p => p.name).join(", ")}.` : `All ${players.length} handouts are ready.`}</strong>
          : <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><LoaderCircle className={page.spin} size={16}/>Loading handouts… {ready.length + failed.length} of {players.length}</span>}
        <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "var(--line-subtle)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#c8102e", transition: "width .3s" }}/></div>
        <small>{ready.length * 2} pages. Print double-sided (flip on the long edge) so each player is one sheet. Talking points print as blank lines; nothing is saved.</small>
      </div>
    </section>
    <div className={sheet.bundle}>{ready.map(p => { const d = slots[p.id].data!; return <HandoutFit key={p.id}><ExitMeetingHandout report={d.report} meetingDate={meetingDate} talkingPoints="" headshot={d.headshot} awards={d.awards}/></HandoutFit>; })}</div>
  </div>;
}
