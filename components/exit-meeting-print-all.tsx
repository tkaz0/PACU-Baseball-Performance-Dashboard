"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Printer, RotateCcw } from "lucide-react";
import { ExitMeetingHandout } from "@/components/exit-meeting-handout";
import { HandoutFit } from "@/components/exit-meeting-handout-fit";
import type { ExitMeetingReport } from "@/lib/exit-meeting";
import type { BwsAward } from "@/lib/game-weeks-server";
import page from "./exit-meeting.module.css";
import sheet from "./exit-meeting-handout.module.css";

type Loaded = { report: ExitMeetingReport; headshot: string | null };
type Slot = { status: "waiting" | "loading" | "ready" | "failed"; data?: Loaded; error?: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const NO_AWARDS: readonly BwsAward[] = [];
// One request at a time, four players per request: the free database tier slows down under parallel team reads.
const BATCH = 4, TRIES = 3;
type BatchItem = { id: string; report?: ExitMeetingReport; headshot?: string | null; error?: string };

async function loadBatch(ids: string[], withAwards: boolean): Promise<{ items: BatchItem[]; awards?: Record<string, BwsAward[]> | null }> {
  let last = "These handouts could not be loaded.";
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      const query = ids.map(id => `athlete=${encodeURIComponent(id)}`).join("&") + (withAwards ? "&awards=1" : "");
      const response = await fetch(`/exit-meetings/report?${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (response.ok && Array.isArray(body?.items)) return body;
      last = typeof body?.error === "string" ? body.error : last;
      if (response.status === 400 || response.status === 401 || response.status === 403) break;
    } catch { /* network hiccup: retry */ }
    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(last);
}

/** Memoized so each newly loaded handout does not re-render and re-fit every handout already on the page. */
const PrintedHandout = memo(function PrintedHandout({ data, meetingDate, awards }: { data: Loaded; meetingDate: string; awards: readonly BwsAward[] }) {
  return <HandoutFit><ExitMeetingHandout report={data.report} meetingDate={meetingDate} talkingPoints="" headshot={data.headshot} awards={awards}/></HandoutFit>;
});

/**
 * Loads every current player's handout (four per request, one request at a time, with retries), then prints them as one job so the
 * browser can save a single PDF. Each handout is two pages, so double-sided printing keeps players apart.
 * Talking points stay blank writing lines; nothing is saved.
 */
export function ExitMeetingPrintAll({ players }: { players: { id: string; name: string }[] }) {
  const [slots, setSlots] = useState<Record<string, Slot>>(() => Object.fromEntries(players.map(p => [p.id, { status: "waiting" } as Slot])));
  const [meetingDate, setMeetingDate] = useState(today);
  const started = useRef(false);
  const [awards, setAwards] = useState<Record<string, BwsAward[]>>({});
  const awardsLoaded = useRef(false);
  const run = useCallback(async (ids: string[]) => {
    for (let at = 0; at < ids.length; at += BATCH) {
      const batch = ids.slice(at, at + BATCH);
      setSlots(s => ({ ...s, ...Object.fromEntries(batch.map(id => [id, { status: "loading" } as Slot])) }));
      try {
        const result = await loadBatch(batch, !awardsLoaded.current);
        if (result.awards) { awardsLoaded.current = true; setAwards(result.awards); }
        setSlots(s => ({ ...s, ...Object.fromEntries(batch.map(id => { const item = result.items.find(i => i.id === id);
          return [id, item?.report ? { status: "ready", data: { report: item.report, headshot: item.headshot ?? null } } : { status: "failed", error: item?.error ?? "Could not load." }] as [string, Slot]; })) }));
      } catch (error) {
        setSlots(s => ({ ...s, ...Object.fromEntries(batch.map(id => [id, { status: "failed", error: error instanceof Error ? error.message : "Could not load." } as Slot])) }));
      }
    }
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
    <div className={sheet.bundle}>{ready.map(p => { const data = slots[p.id].data!; return <PrintedHandout key={p.id} data={data} meetingDate={meetingDate} awards={awards[data.report.code] ?? NO_AWARDS}/>; })}</div>
  </div>;
}
