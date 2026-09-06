"use client";

import { useState } from "react";
import { Activity, CircleDot, CalendarDays, Swords } from "lucide-react";
import { RenphoReportForm } from "@/components/renpho-import";
import { FullSwingImport } from "@/components/full-swing-import";
import { loadSharedReportMeasurements, saveReviewedMeasurements } from "@/app/(workspace)/imports/actions";
import type { Measurement } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

const lanes = [
  { key: "physicality", label: "Physicality", source: "RENPHO Reports", icon: Activity },
  { key: "hitting", label: "Hitting", source: "Full Swing CSV", icon: Swords },
  { key: "pitching", label: "Pitching", source: "Full Swing CSV", icon: CircleDot },
  { key: "games", label: "Games / Intrasquad", source: "Full Swing CSV", icon: CalendarDays },
] as const;
type Lane = (typeof lanes)[number]["key"];

export function TeamImportCenter({ roster }: { roster: RosterAthlete[] }) {
  const [lane, setLane] = useState<Lane>("physicality");
  const [gameKind, setGameKind] = useState<"game" | "intrasquad">("intrasquad");
  const [receipt, setReceipt] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(measurements: Measurement[]): Promise<string> {
    setSaving(true);
    try {
      const result = await saveReviewedMeasurements(measurements, true);
      if ("error" in result) throw new Error(result.error);
      const message = `Saved to player profiles: ${result.created} new readings · ${result.unchanged} already present.`;
      setReceipt(message); return message;
    } finally { setSaving(false); }
  }
  return <div className="space-y-6">
    <div className="grid gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Import category">
      {lanes.map(item => <button key={item.key} type="button" disabled={saving} aria-pressed={lane === item.key} onClick={() => { setLane(item.key); setReceipt(""); }}
        className={`panel min-w-0 p-5 text-left transition-colors ${lane === item.key ? "border-[var(--accent-readable)] ring-1 ring-[var(--accent-readable)]" : "hover:border-[var(--accent-readable)]"}`}>
        <item.icon size={22} className="mb-4 text-[var(--accent-readable)]" aria-hidden="true" />
        <span className="block text-base font-bold">{item.label}</span>
        <span className="muted mt-1 block text-sm">{item.source}</span>
      </button>)}
    </div>
    {!roster.length ? <p className="notice">No players are on the 2026–27 roster yet. An admin can add the roster before measurements are imported.</p> : <>
      {lane === "games" && <div className="panel p-5"><label className="max-w-sm">Session Type<select disabled={saving} value={gameKind} onChange={event => { setGameKind(event.target.value as "game" | "intrasquad"); setReceipt(""); }}><option value="intrasquad">Intrasquad</option><option value="game">Game</option></select></label></div>}
      {lane === "physicality" ? <RenphoReportForm workspace={{ roster, measurements: [], revision: 0, ready: true, error: null, applyRenphoReport: async measurements => { await save(measurements); } }} shared={{ receipt,
        profileHref: code => `/athletes/${roster.find(athlete => athlete.athlete_code === code)!.id}`,
        loadExisting: async hash => { const result = await loadSharedReportMeasurements(hash); if ("error" in result) throw new Error(result.error); return result.measurements; },
      }} /> : <FullSwingImport key={lane === "games" ? gameKind : lane} category={lane === "games" ? gameKind : lane} roster={roster} saveAction={save} />}
    </>}
  </div>;
}
