"use client";

import { useId, useState } from "react";
import styles from "./import-presentation.module.css";
import { Activity, CircleDot, CalendarDays, Swords } from "lucide-react";
import { RenphoReportForm } from "@/components/renpho-import";
import { FullSwingImport } from "@/components/full-swing-import";
import { loadPitchAssignments, savePitchAssignments, loadSharedReportMeasurements, matchSharedRenphoPlayer, saveReviewedMeasurements, saveReviewedRenphoMeasurements } from "@/app/(workspace)/imports/actions";
import type { ReadingsSaved } from "@/lib/import-confirmation";
import type { Measurement } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

const pitchAssignmentStore = {
  load: async (hash: string) => {const result=await loadPitchAssignments(hash);if("error" in result)throw new Error(result.error);return result;},
  save: async (hash: string, version: number, assignments: import("@/lib/imports/pitch-assignments").PitchAssignment[]) => {const result=await savePitchAssignments(hash,version,assignments);if("error" in result)throw new Error(result.error);return result;},
};

const lanes = [
  { key: "physicality", label: "Physicality", source: "RENPHO Reports", icon: Activity },
  { key: "hitting", label: "Hitting", source: "Full Swing CSV", icon: Swords },
  { key: "blast", label: "Blast Motion", source: "Hitting CSV", icon: Swords },
  { key: "pitching", label: "Pitching", source: "Full Swing CSV", icon: CircleDot },
  { key: "games", label: "Games / Intrasquad", source: "Full Swing CSV", icon: CalendarDays },
] as const;
type Lane = (typeof lanes)[number]["key"];

export function TeamImportCenter({ roster }: { roster: RosterAthlete[] }) {
  const sessionId = useId();
  const [lane, setLane] = useState<Lane>("physicality");
  const [gameKind, setGameKind] = useState<"game" | "intrasquad">("intrasquad");
  const [saving, setSaving] = useState(false);
  async function save(measurements: Measurement[], identity?: { athleteCode: string; renphoId: string }): Promise<ReadingsSaved> {
    setSaving(true);
    try {
      const result = identity ? await saveReviewedRenphoMeasurements(measurements, true, identity) : await saveReviewedMeasurements(measurements, true);
      if ("error" in result) throw new Error(result.error);
      return { created: result.created, unchanged: result.unchanged };
    } finally { setSaving(false); }
  }
  return <div className="space-y-6">
    <div className={styles.lanes} role="group" aria-label="Import category">
      {lanes.map(item => <button key={item.key} type="button" disabled={saving} aria-pressed={lane === item.key} onClick={() => { setLane(item.key); }}
        className={styles.lane}>
        <span className={styles.laneIcon}><item.icon size={19} aria-hidden="true" /></span>
        <span><span className={styles.laneName}>{item.label}</span><span className={styles.laneSource}>{item.source}</span></span>
      </button>)}
    </div>
    {!roster.length ? <p className="notice">No players are on the 2026–27 roster yet. An admin can add the roster before measurements are imported.</p> : <>
      {lane === "games" && <div className={styles.session}><label htmlFor={sessionId} className={styles.sessionLabel}>Session Type</label><select id={sessionId} disabled={saving} value={gameKind} onChange={event => { setGameKind(event.target.value as "game" | "intrasquad"); }}><option value="intrasquad">Intrasquad</option><option value="game">Game</option></select></div>}
      {lane === "physicality" ? <RenphoReportForm workspace={{ roster, measurements: [], revision: 0, ready: true, error: null, applyRenphoReport: async (measurements, _batch, _revision, identity) => { await save(measurements, { athleteCode: identity.athleteCode, renphoId: identity.renphoId ?? "" }); } }} shared={{ save,
        profileHref: code => `/athletes/${roster.find(athlete => athlete.athlete_code === code)!.id}`,
        loadExisting: async hash => { const result = await loadSharedReportMeasurements(hash); if ("error" in result) throw new Error(result.error); return result.measurements; },
        matchPlayer: async id => { const result = await matchSharedRenphoPlayer(id); if ("error" in result) throw new Error(result.error); return result.athleteCode; },
      }} /> : <FullSwingImport key={lane === "games" ? gameKind : lane} vendor={lane === "blast" ? "Blast Motion" : "Full Swing"} category={lane === "games" ? gameKind : lane === "blast" ? "hitting" : lane} roster={roster} saveAction={save} assignmentStore={pitchAssignmentStore} />}
    </>}
  </div>;
}
