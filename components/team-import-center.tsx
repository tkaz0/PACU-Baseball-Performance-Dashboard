"use client";

import { useId, useState } from "react";
import styles from "./import-presentation.module.css";
import { Activity, CircleDot, CalendarDays, Swords, Check } from "lucide-react";
import { RenphoReportForm } from "@/components/renpho-import";
import { BlastMotionImport } from "@/components/blast-motion-import";
import { FullSwingImport } from "@/components/full-swing-import";
import { loadPitchAssignments, savePitchAssignments, loadSharedReportMeasurements, matchSharedRenphoPlayer, saveReviewedMeasurements, saveReviewedRenphoMeasurements, saveReviewedFullSwingSamples, saveReviewedExistingFullSwingSamples } from "@/app/(workspace)/imports/actions";
import type { ReadingsSaved } from "@/lib/import-confirmation";
import type { Measurement } from "@/lib/imports/engine";
import type { RosterAthlete } from "@/lib/types";

const pitchAssignmentStore = {
  load: async (hash: string) => {const result=await loadPitchAssignments(hash);if("error" in result)throw new Error(result.error);return result;},
  save: async (hash: string, version: number, assignments: import("@/lib/imports/pitch-assignments").PitchAssignment[]) => {const result=await savePitchAssignments(hash,version,assignments);if("error" in result)throw new Error(result.error);return result;},
};

const lanes = [
  { key: "physicality", label: "Physicality", source: "RENPHO", format: "Image or PDF", detail: "Body composition from a one-page RENPHO report.", icon: Activity },
  { key: "hitting", label: "Hitting", source: "Full Swing", format: "CSV", detail: "Full Swing sessions and summaries. Match hitters and pitchers from one file.", icon: Swords },
  { key: "blast", label: "Blast Motion", source: "Practice Hitting", format: "CSV", detail: "Weekly practice averages or peak reports.", icon: Swords },
  { key: "pitching", label: "Pitching", source: "Full Swing", format: "CSV", detail: "Full Swing sessions and summaries. Match pitchers and hitters from one file.", icon: CircleDot },
  { key: "games", label: "Game / Intrasquad", source: "Full Swing", format: "CSV", detail: "Live at-bat exports and player session summaries.", icon: CalendarDays },
] as const;
type Lane = (typeof lanes)[number]["key"];

export function TeamImportCenter({ roster }: { roster: RosterAthlete[] }) {
  const sessionId = useId();
  const [lane, setLane] = useState<Lane>("physicality");
  const [gameKind, setGameKind] = useState<"game" | "intrasquad" | "practice">("intrasquad");
  const [saving, setSaving] = useState(false);
  const selectedLane = lanes.find(item => item.key === lane)!;
  async function save(measurements: Measurement[], identity?: { athleteCode: string; renphoId: string }): Promise<ReadingsSaved> {
    setSaving(true);
    try {
      const result = identity ? await saveReviewedRenphoMeasurements(measurements, true, identity) : await saveReviewedMeasurements(measurements, true);
      if ("error" in result) throw new Error(result.error);
      return { created: result.created, unchanged: result.unchanged };
    } finally { setSaving(false); }
  }
  return <div className={styles.importCenter}>
    <div className={styles.sourceHeading}><h2>Choose Your Report</h2><span>Match the source on your file</span></div>
    <div className={styles.lanes} role="group" aria-label="Import category">
      {lanes.map(item => <button key={item.key} type="button" disabled={saving} aria-pressed={lane === item.key} onClick={() => { setLane(item.key); if (item.key === "games") setGameKind("intrasquad"); else if (item.key === "hitting" || item.key === "pitching") setGameKind("practice"); }}
        className={styles.lane}>
        <span className={styles.laneIcon}><item.icon size={19} aria-hidden="true" /></span>
        <span><span className={styles.laneName}>{item.label}</span><span className={styles.laneSource}>{item.source}</span></span>
        {lane === item.key && <Check className={styles.laneCheck} size={15} aria-hidden="true" />}
      </button>)}
    </div>
    <div className={styles.selectedSource} aria-live="polite"><div><h2>{selectedLane.label}</h2><p>{selectedLane.detail}</p></div><span className={styles.formatBadge}>{selectedLane.format}</span></div>
    {!roster.length ? <p className="notice">No players are on the 2026–27 roster yet. An admin can add the roster before measurements are imported.</p> : <>
      {(lane === "hitting" || lane === "pitching" || lane === "games") && <div className={styles.session}><label htmlFor={sessionId} className={styles.sessionLabel}>Session Type</label><select id={sessionId} disabled={saving} value={gameKind} onChange={event => { setGameKind(event.target.value as "game" | "intrasquad" | "practice"); }}><option value="intrasquad">Intrasquad · In-Game</option><option value="game">Game · In-Game</option><option value="practice">Practice</option></select></div>}
      {lane === "physicality" ? <RenphoReportForm workspace={{ roster, measurements: [], revision: 0, ready: true, error: null, applyRenphoReport: async (measurements, _batch, _revision, identity) => { await save(measurements, { athleteCode: identity.athleteCode, renphoId: identity.renphoId ?? "" }); } }} shared={{ save,
        profileHref: code => `/athletes/${roster.find(athlete => athlete.athlete_code === code)!.id}`,
        loadExisting: async hash => { const result = await loadSharedReportMeasurements(hash); if ("error" in result) throw new Error(result.error); return result.measurements; },
        matchPlayer: async id => { const result = await matchSharedRenphoPlayer(id); if ("error" in result) throw new Error(result.error); return result.athleteCode; },
      }} /> : lane === "blast" ? <BlastMotionImport roster={roster} saveAction={save}/> : <FullSwingImport key={`${lane}:${gameKind}`} vendor="Full Swing" category={lane === "games" ? gameKind : lane} sourceCategory={gameKind} roster={roster} saveAction={save} saveSamples={saveReviewedFullSwingSamples} saveExistingSamples={saveReviewedExistingFullSwingSamples} assignmentStore={pitchAssignmentStore} />}
    </>}
  </div>;
}
