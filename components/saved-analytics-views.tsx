"use client";
import { useRef, useState, useTransition } from "react";
import { Bookmark, Archive, Save } from "lucide-react";
import { archiveAnalyticsView, saveAnalyticsView } from "@/app/(workspace)/analytics/view-actions";
import type { AnalyticsViewConfig, SavedAnalyticsView } from "@/lib/saved-analytics";
import styles from "./personal-dashboard.module.css";
export function SavedAnalyticsViews({ initialViews, current, onLoad }: { initialViews: SavedAnalyticsView[]; current: AnalyticsViewConfig | null; onLoad: (view: SavedAnalyticsView) => string | null }) {
  const [views, setViews] = useState(initialViews), [name, setName] = useState(""), [selected, setSelected] = useState(""), [message, setMessage] = useState(""), [pending, start] = useTransition();
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  function save() {
    if (!current || !name.trim()) { setMessage("Name this view and choose two different stats."); return; }
    const fingerprint = JSON.stringify([name.trim(), current]);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    const id = request.current.id;
    start(async () => { try { const result = await saveAnalyticsView({ id, name, config: current }); if (result.views) { setViews(result.views); setSelected(id); setName(""); request.current = null; setMessage("View saved to your account."); } else setMessage(result.error ?? "Save could not be confirmed."); } catch { setMessage("Save could not be confirmed. Retry without changing the view."); } });
  }
  return <section className={`panel ${styles.savedViews}`} aria-label="Saved analytics views"><div><h2><Bookmark size={17} aria-hidden="true"/>My Saved Views</h2><p>Keep your favorite stats, filters and colors together.</p></div><div className={styles.viewControls}><label>Saved View<select value={selected} disabled={pending} onChange={e => { setSelected(e.target.value); setMessage(""); }}><option value="">Choose a saved view</option>{views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button type="button" className="btn btn-secondary" disabled={!selected || pending} onClick={() => { const view = views.find(v => v.id === selected); if (view) setMessage(onLoad(view) ?? `Opened ${view.name}.`); }}>Open View</button><button type="button" className="btn btn-secondary" aria-label="Archive selected saved view" disabled={!selected || pending} onClick={() => start(async () => { try { const result = await archiveAnalyticsView(selected); if (result.views) { setViews(result.views); setSelected(""); setMessage("View archived."); } else setMessage(result.error ?? "Could not archive this view."); } catch { setMessage("Could not confirm the archive. Refresh to check."); } })}><Archive size={15}/></button></div><div className={styles.viewControls}><label>New View Name<input value={name} maxLength={60} disabled={pending} placeholder="e.g. Bat Speed & Exit Velo" onChange={e => setName(e.target.value)}/></label><button type="button" className="btn btn-primary" onClick={save} disabled={pending || !current || views.length >= 20}><Save size={15}/>{pending ? "Saving…" : "Save Current View"}</button></div>{message && <p role="status" className={styles.message}>{message}</p>}</section>;
}
