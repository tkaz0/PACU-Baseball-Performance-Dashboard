"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { HEADERS } from "@/lib/roster/csv";
import { getPreviewRoster } from "@/lib/preview-roster";
import type { RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";
import { emptyWorkspace, readWorkspace, validateWorkspace, writeWorkspace, type ImportBatch, type LocalWorkspace } from "@/lib/local-workspace";
export type { ImportBatch } from "@/lib/local-workspace";

type WorkspaceContext = {
  roster: RosterAthlete[]; measurements: Measurement[]; batches: ImportBatch[];
  ready: boolean; error: string | null; mode: "sample" | "local"; revision: number;
  applyRoster: (roster: RosterAthlete[], batch: ImportBatch, expectedRevision: number) => Promise<void>;
  applyMeasurements: (measurements: Measurement[], batch: ImportBatch, expectedRevision: number) => Promise<void>;
  removeBatch: (id: string) => Promise<void>; resetWorkspace: () => Promise<void>;
  exportBackup: () => void; restoreBackup: (text: string) => Promise<void>;
  exportRoster: (season: string) => void;
};
const Context = createContext<WorkspaceContext | null>(null);

export function LocalWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalWorkspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => readWorkspace().then(data => { if (active) { setState(data); setError(null); } }).catch(() => { if (active) setError("Saved data could not be opened. Imports are paused; reload after enabling browser storage."); }).finally(() => { if (active) setReady(true); });
    void refresh();
    if (typeof BroadcastChannel !== "undefined") { channel.current = new BroadcastChannel("pacu-workspace-updates"); channel.current.onmessage = () => void refresh(); }
    return () => { active = false; channel.current?.close(); };
  }, []);
  const roster = state.mode === "sample" ? getPreviewRoster() : state.roster;
  async function commit(next: LocalWorkspace, expectedRevision: number) {
    if (!ready || error) throw new Error("Reload the workspace before saving.");
    if (expectedRevision !== state.revision) throw new Error("Data changed after this preview. Preview the file again before saving.");
    const saved = await writeWorkspace(next, expectedRevision);
    setState(saved);
    channel.current?.postMessage({ updated: true });
  }
  const value: WorkspaceContext = {
    roster, measurements: state.measurements, batches: state.batches, ready, error, mode: state.mode, revision: state.revision,
    applyRoster: async (candidate, batch, revision) => {
      const codes = new Set(candidate.map(a => a.athlete_code));
      if (state.measurements.some(m => !codes.has(m.athlete_code))) throw new Error("This roster would disconnect existing measurements. Keep those athlete codes or remove the measurement batches first.");
      await commit({ ...state, mode: "local", roster: candidate, batches: [...state.batches, batch] }, revision);
    },
    applyMeasurements: async (newMeasurements, batch, revision) => {
      await commit({ ...state, mode: "local", roster, measurements: [...state.measurements, ...newMeasurements.map(m => ({ ...m, batch_id: batch.id }))], batches: [...state.batches, batch] }, revision);
    },
    removeBatch: async id => {
      const batch = state.batches.find(b => b.id === id);
      if (!batch || batch.kind !== "measurements") throw new Error("Only measurement batches can be removed. Roster updates preserve athlete identities.");
      await commit({ ...state, measurements: state.measurements.filter(m => m.batch_id !== id), batches: state.batches.filter(b => b.id !== id) }, state.revision);
    },
    resetWorkspace: async () => { await commit({ ...emptyWorkspace(), revision: state.revision }, state.revision); },
    exportBackup: () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `pacu-workspace-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    exportRoster: season => {
      const rows = roster.filter(a => a.athlete_seasons.some(s => s.season === season)).map(a => {
        const seasonal = a.athlete_seasons.find(s => s.season === season)!;
        const combined = { ...a, ...seasonal };
        return HEADERS.map(field => combined[field] ?? "");
      });
      const csv = Papa.unparse({ fields: [...HEADERS], data: rows }, { escapeFormulae: true });
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
  return <div className="bg-pacu-red px-6 py-3 text-sm font-semibold text-white lg:px-10" role="status">{error || (!ready ? "Opening your workspace…" : mode === "sample" ? "Sample roster · Fictional athletes · No sign-in needed" : "Saved in this browser · Export a backup to keep or transfer your data")}</div>;
}
