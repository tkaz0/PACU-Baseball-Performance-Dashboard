"use client";

import { useState } from "react";
import { Activity, CircleDot, Dumbbell, Swords } from "lucide-react";
import { RenphoReportForm } from "@/components/renpho-import";
import { FullSwingImport } from "@/components/full-swing-import";
import { loadSharedReportMeasurements, saveReviewedMeasurements } from "@/app/(workspace)/imports/actions";
import type { Measurement } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

const lanes = [
  { key: "physicality", label: "Physicality", source: "RENPHO Reports", icon: Activity, detail: "Body composition and measurements" },
  { key: "hitting", label: "Hitting", source: "Full Swing CSV", icon: Swords, detail: "Exit velocity and bat speed" },
  { key: "pitching", label: "Pitching", source: "Full Swing CSV", icon: CircleDot, detail: "Velocity, spin, and percentages" },
  { key: "games", label: "Games / Intrasquad", source: "Full Swing CSV", icon: Dumbbell, detail: "Game and intrasquad summaries" },
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Import category">
      {lanes.map(item => <button key={item.key} type="button" disabled={saving} aria-pressed={lane === item.key} onClick={() => { setLane(item.key); setReceipt(""); }}
        className={`panel min-w-0 p-5 text-left transition-colors ${lane === item.key ? "ring-2 ring-red-600" : "hover:border-red-400"}`}>
        <item.icon size={24} className="mb-4 text-red-700" aria-hidden="true" />
        <span className="block text-base font-bold">{item.label}</span>
        <span className="mt-1 block text-sm font-semibold text-red-700">{item.source}</span>
        <span className="muted mt-3 block text-xs leading-relaxed">{item.detail}</span>
      </button>)}
    </div>
    {!roster.length ? <p className="notice">No players are on the 2026–27 roster yet. An admin can add the roster before measurements are imported.</p> : <>
      {lane === "games" && <div className="panel p-5"><label className="max-w-sm">Session Type<select disabled={saving} value={gameKind} onChange={event => { setGameKind(event.target.value as "game" | "intrasquad"); setReceipt(""); }}><option value="intrasquad">Intrasquad</option><option value="game">Game</option></select></label><p className="muted mb-0 mt-3 text-sm">Full Swing session readings stay separate from the Fall 2026 game stats in Google Sheets.</p></div>}
      {lane === "physicality" ? <RenphoReportForm workspace={{ roster, measurements: [], revision: 0, ready: true, error: null, applyRenphoReport: async measurements => { await save(measurements); } }} shared={{ receipt,
        profileHref: code => `/athletes/${roster.find(athlete => athlete.athlete_code === code)!.id}`,
        loadExisting: async hash => { const result = await loadSharedReportMeasurements(hash); if ("error" in result) throw new Error(result.error); return result.measurements; },
      }} /> : <FullSwingImport key={lane === "games" ? gameKind : lane} category={lane === "games" ? gameKind : lane} roster={roster} saveAction={save} />}
    </>}
  </div>;
}
