"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getPreviewRoster } from "@/lib/preview-roster";
import type { RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";
import { getPlayerPerformance, type PlayerPerformance } from "@/lib/player-performance";
import { adminView, canonicalLocalView, LOCAL_VIEW_KEY, parseLocalView, projectLocalView, type LocalView } from "@/lib/local-view";
import { emptyWorkspace, readWorkspace, validateWorkspace, writeWorkspace, exportLocalRosterCsv, prepareRenphoReport, type ImportBatch, type LocalWorkspace, type RenphoReportIdentity } from "@/lib/local-workspace";
export type { ImportBatch } from "@/lib/local-workspace";

type WorkspaceContext = {
  view: LocalView; setView: (view: LocalView) => void; canManage: boolean;
  viewChoices: { code: string; name: string }[];
  roster: RosterAthlete[]; measurements: Measurement[]; batches: ImportBatch[];
  getPerformance: (athleteCode: string) => PlayerPerformance;
  ready: boolean; error: string | null; mode: "sample" | "local"; revision: number;
  applyRoster: (roster: RosterAthlete[], batch: ImportBatch, expectedRevision: number) => Promise<void>;
  applyMeasurements: (measurements: Measurement[], batch: ImportBatch, expectedRevision: number) => Promise<void>;
  applyRenphoReport: (measurements: Measurement[], batch: ImportBatch, expectedRevision: number, identity: RenphoReportIdentity) => Promise<void>;
  removeBatch: (id: string) => Promise<void>; resetWorkspace: () => Promise<void>;
  exportBackup: () => void; restoreBackup: (text: string) => Promise<void>;
  exportRoster: (season: string) => void;
};
const Context = createContext<WorkspaceContext | null>(null);

export function LocalWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalWorkspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<LocalView>(adminView);
  const currentView = useRef<LocalView>(adminView());
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    let active = true;
    try { currentView.current = parseLocalView(sessionStorage.getItem(LOCAL_VIEW_KEY)); setViewState(currentView.current); } catch { /* View switching still works when session storage is unavailable. */ }
    const refresh = () => readWorkspace().then(data => {
      if (active) {
        const checked = canonicalLocalView(currentView.current, data.mode === "sample" ? getPreviewRoster() : data.roster);
        currentView.current = checked; setViewState(checked);
        try { sessionStorage.setItem(LOCAL_VIEW_KEY, JSON.stringify(checked)); } catch { /* Optional tab preference. */ }
        setState(data); setError(null);
      }
    }).catch(() => { if (active) setError("Saved data could not be opened. Imports are paused; reload after enabling browser storage."); }).finally(() => { if (active) setReady(true); });
    void refresh();
    if (typeof BroadcastChannel !== "undefined") { channel.current = new BroadcastChannel("pacu-workspace-updates"); channel.current.onmessage = () => void refresh(); }
    return () => { active = false; channel.current?.close(); };
  }, []);
  const roster = state.mode === "sample" ? getPreviewRoster() : state.roster;
  const visible = projectLocalView(view, roster, state.measurements);
  const visibleBatchIds = new Set(visible.measurements.map(m => m.batch_id));
  function assertManage() {
    if (currentView.current.role !== "admin") throw new Error("Exit preview before changing or exporting workspace data.");
  }
  async function commit(next: LocalWorkspace, expectedRevision: number) {
    assertManage();
    if (!ready || error) throw new Error("Reload the workspace before saving.");
    if (expectedRevision !== state.revision) throw new Error("Data changed after this preview. Preview the file again before saving.");
    const saved = await writeWorkspace(next, expectedRevision);
    setState(saved);
    channel.current?.postMessage({ updated: true });
  }
  const value: WorkspaceContext = {
    view, canManage: view.role === "admin",
    viewChoices: roster.map(a => ({ code: a.athlete_code, name: `${a.preferred_name || a.first_name} ${a.last_name}` })).sort((a, b) => a.name.localeCompare(b.name)),
    setView: next => {
      const checked = canonicalLocalView(parseLocalView(JSON.stringify(next)), roster);
      currentView.current = checked; setViewState(checked);
      try { sessionStorage.setItem(LOCAL_VIEW_KEY, JSON.stringify(checked)); } catch { /* Optional tab preference; not workspace data. */ }
    },
    roster: visible.roster, measurements: visible.measurements,
    getPerformance: athleteCode => {
      if (!visible.roster.some(athlete => athlete.athlete_code === athleteCode)) {
        return getPlayerPerformance({ readings: [], athleteCode, cohortAthleteCodes: [] });
      }
      const cohortAthleteCodes = roster.filter(athlete => athlete.athlete_seasons.some(season =>
        season.season === "2026-27" && (season.roster_status === null || season.roster_status === "active" || season.roster_status === "redshirt"),
      )).map(athlete => athlete.athlete_code);
      // Return only the visible athlete's readings and aggregate comparisons.
      // Other players' raw readings remain outside the projected context.
      return getPlayerPerformance({ readings: state.measurements, batches: state.batches, athleteCode, cohortAthleteCodes });
    },
    batches: view.role === "admin" ? state.batches : state.batches.filter(b => visibleBatchIds.has(b.id)),
    ready, error, mode: state.mode, revision: state.revision,
    applyRoster: async (candidate, batch, revision) => {
      const codes = new Set(candidate.map(a => a.athlete_code));
      if (state.measurements.some(m => !codes.has(m.athlete_code))) throw new Error("This roster would disconnect existing measurements. Keep those athlete codes or remove the measurement batches first.");
      await commit({ ...state, mode: "local", roster: candidate, batches: [...state.batches, batch] }, revision);
    },
    applyMeasurements: async (newMeasurements, batch, revision) => {
      await commit({ ...state, mode: "local", roster, measurements: [...state.measurements, ...newMeasurements.map(m => ({ ...m, batch_id: batch.id }))], batches: [...state.batches, batch] }, revision);
    },
    applyRenphoReport: async (measurements, batch, revision, identity) => {
      await commit(prepareRenphoReport(state, roster, measurements, batch, identity), revision);
    },
    removeBatch: async id => {
      const batch = state.batches.find(b => b.id === id);
      if (!batch || batch.kind !== "measurements") throw new Error("Only measurement batches can be removed. Roster updates preserve athlete identities.");
      await commit({ ...state, measurements: state.measurements.filter(m => m.batch_id !== id), batches: state.batches.filter(b => b.id !== id) }, state.revision);
    },
    resetWorkspace: async () => { await commit({ ...emptyWorkspace(), revision: state.revision }, state.revision); },
    exportBackup: () => {
      assertManage();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `pacu-workspace-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    exportRoster: season => {
      assertManage();
      const csv = exportLocalRosterCsv(roster, season);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `pacu-roster-${season}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    restoreBackup: async text => {
      if (text.length > 30 * 1024 * 1024) throw new Error("Backup is too large (30 MB maximum).");
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new Error("This file is not a valid JSON backup."); }
      await commit({ ...validateWorkspace(data), revision: state.revision }, state.revision);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLocalWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Local workspace provider is missing.");
  return context;
}

export function WorkspaceBanner() {
  const { mode, ready, error } = useLocalWorkspace();
  return <div className="bg-pacu-red px-6 py-3 text-sm font-semibold text-white lg:px-10" role="status">{error || (!ready ? "Opening your workspace…" : mode === "sample" ? "Sample roster · Fictional athletes · Administrator workspace" : "Saved in this browser · Export a backup to keep or transfer your data")}</div>;
}
