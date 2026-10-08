"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, Download, LockKeyhole, Printer, Search, Settings2, Trophy, Undo2, X } from "lucide-react";
import { PacificLogo } from "@/components/pacific-brand";
import { saveBoxerDraft } from "@/app/(workspace)/admin/draft-board/actions";
import { DRAFT_GROUPS, draftable, draftExportRows, draftPlayersFromGroups, draftView, emptyDraft, validateDraftDocument, type DraftDocument, type DraftGroup, type DraftPlayer, type DraftSaveRequest, type DraftSnapshot } from "@/lib/draft-board";
import { DraftDepthChart, DraftBigBoard } from "@/components/draft-planning";
import type { DraftPerformance } from "@/lib/draft-performance";
import { draftPlanning, draftOpenPositions, draftCovers, nextDraftSelection, withDraftPicks } from "@/lib/draft-board";
import styles from "./draft-board.module.css";

export function DraftBoard({ initial, athletes, performance }: { initial: DraftSnapshot | null; athletes: { id: string; name: string }[]; performance: DraftPerformance[] | null }) {
  const [saved, setSaved] = useState(initial), [document, setDocument] = useState<DraftDocument>(initial?.document ?? emptyDraft());
  const [setup, setSetup] = useState(!initial), [search, setSearch] = useState(""), [group, setGroup] = useState<DraftGroup | "All">("All");
  const [selected, setSelected] = useState<string | null>(null), [pending, setPending] = useState(false), [retry, setRetry] = useState<DraftSaveRequest | null>(null);
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [undo, setUndo] = useState(false);
  const [bigBoard, setBigBoard] = useState(false);
  const view = draftView(document), chosen = view.available.find(p => p.id === selected), blocked = pending || !!retry;
  const matches = (p: DraftPlayer) => `${p.name} ${p.positions}`.toLowerCase().includes(search.trim().toLowerCase());
  const plan = draftPlanning(document), open = view.nextTeam === null ? [] : draftOpenPositions(document, view.nextTeam);
  const fits = plan.bigBoard.flatMap(id => { const p = view.available.find(p => p.id === id); return p && open.some(pos => draftCovers(p, pos)) ? [p] : []; }).slice(0, 4);
  const visible = (group === "Injured / Student Assistants" ? document.players.filter(p => !draftable(p)) : view.available).filter(p => (group === "All" || p.group === group) && matches(p)).sort((a,b) => plan.bigBoard.indexOf(a.id)-plan.bigBoard.indexOf(b.id));
  async function commit(next: DraftDocument, existing?: DraftSaveRequest) {
    let request: DraftSaveRequest;
    try { request = existing ?? { requestId: crypto.randomUUID(), expectedRevision: saved?.revision ?? 0, document: validateDraftDocument(next) }; }
    catch (e) { setError(e instanceof Error ? e.message : "Check your draft details."); return; }
    setPending(true); setError(""); setMessage(""); setRetry(request);
    try {
      const result = await saveBoxerDraft(request);
      if (!result.ok) { setError(result.message); return; }
      setSaved(result.board); setDocument(result.board.document); setRetry(null); setSetup(false); setBigBoard(false); setSelected(null); setUndo(false); setMessage("Draft saved.");
    } catch { setError("The save was not confirmed. Retry the same change or reload the saved board to check it."); }
    finally { setPending(false); }
  }
  function download() {
    // Neutralize spreadsheet formulas in owner-editable names; quotes preserve commas/newlines.
    const quote = (s: string) => `"${(/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
    const blob = new Blob(["\ufeff" + draftExportRows(document).map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = window.document.createElement("a"); a.href = url; a.download = "boxer-world-series-draft.csv"; a.click(); URL.revokeObjectURL(url);
  }
  const playerName = (player: DraftPlayer) => player.athleteId ? <Link prefetch={false} href={`/athletes/${player.athleteId}`}>{player.name}</Link> : player.name;
  return <div className={styles.room} aria-busy={pending}>
    <div className={styles.toolbar}><span className={styles.private}><LockKeyhole size={14}/>Only You · Fall 2026</span><div><button type="button" className="btn btn-secondary" disabled={blocked || setup} aria-pressed={bigBoard} onClick={() => setBigBoard(!bigBoard)}>{bigBoard ? "Draft Room" : "Big Board"}</button><button type="button" className="btn btn-secondary" disabled={blocked || bigBoard} onClick={() => { setSetup(!setup); setError(""); }}><Settings2 size={15}/>{setup ? "Close Setup" : "Draft Setup"}</button><button type="button" className="btn btn-secondary" onClick={download} disabled={!saved || blocked}><Download size={15}/>Export</button><button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={!saved || blocked}><Printer size={15}/>Print</button></div></div>
    {message && <p role="status" className="notice">{message}</p>}
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {retry && !pending && <div className={styles.retry}><p>This change is held for an identical retry. Reloading shows the last saved board.</p><button className="btn btn-primary" onClick={() => commit(retry.document, retry)}>Retry Same Change</button><button className="btn btn-secondary" onClick={() => { window.location.reload(); }}>Reload Saved Board</button></div>}
    {setup && <DraftSetup key={saved?.revision ?? 0} document={document} athletes={athletes} disabled={blocked || document.picks.length > 0} onSave={next => commit(next)} onError={setError}/>}
    <section className={styles.hero} aria-label="Draft status">
      <PacificLogo decorative/><div><p className={styles.eyebrow}>BOXER WORLD SERIES · DRAFT ROOM</p><h2>{document.title}</h2><p>{view.pool.length} in the pool · {document.picks.length} selected · {view.available.length} available</p></div>
      <div className={styles.onClock}>{view.complete ? <><Trophy size={22}/><strong>Draft Complete</strong><span>Both teams are ready.</span></> : !view.pool.length ? <><strong>Set Up Your Draft</strong><span>Add the draft list to get started.</span></> : <><span>On the Clock · Pick {String(view.nextPick).padStart(2, "0")}</span><strong>{document.teams[view.nextTeam ?? 0].name}</strong><span>Snake order · 1, 2, 2, 1</span></>}</div>
    </section>
    <div className={styles.progress} role="img" aria-label={`${document.picks.length} of ${view.pool.length} picks made`}><span style={{ width: `${view.pool.length ? document.picks.length / view.pool.length * 100 : 0}%` }}/></div>
    <div hidden={!bigBoard}><DraftBigBoard key={saved?.revision ?? 0} document={document} performance={performance} disabled={blocked} onSave={next => commit(next)} onError={setError}/></div>
    <div className={styles.main} hidden={bigBoard}>
      <section className={styles.pool} aria-label="Available players">
        <header className={styles.sectionHead}><div><p className={styles.eyebrow}>DRAFT POOL</p><h3>Available Players <span>{view.available.length}</span></h3></div></header>
        <div className={styles.filters}><label><Search size={16}/><span className="sr-only">Search draft players</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or position"/></label><label><span className="sr-only">Draft position group</span><select value={group} onChange={e => setGroup(e.target.value as DraftGroup | "All")}><option value="All">All Positions</option>{DRAFT_GROUPS.map(name => <option key={name} value={name}>{name} ({document.players.filter(p => p.group === name && (!draftable(p) || !document.picks.includes(p.id))).length})</option>)}</select></label></div>
        {!setup && !bigBoard && fits.length > 0 && <details className={styles.fitSuggestions}><summary>Fits for {document.teams[view.nextTeam ?? 0].name}</summary><p>Open spots: {open.join(" · ")}. Ordered by your saved big board; unassigned players may already cover these spots.</p>{fits.map(p=><button key={p.id} disabled={blocked} onClick={()=>setSelected(p.id)}><strong>#{plan.bigBoard.indexOf(p.id)+1} {p.name}</strong><small>{open.filter(pos=>draftCovers(p,pos)).join(" / ")}</small></button>)}</details>}
        <div className={styles.poolList}>{visible.map(player => <button type="button" className={styles.player} key={player.id} aria-pressed={selected === player.id} disabled={blocked || !draftable(player) || !saved || setup} onClick={() => setSelected(player.id)}><span className={styles.avatar}>{player.name.split(/\s+/).map(w => w[0]).slice(0, 2).join("")}</span><span><strong>{player.name}</strong><small>{player.group}{player.positions ? ` · ${player.positions}` : ""} · Board #{plan.bigBoard.indexOf(player.id) + 1 || "—"}</small></span>{selected === player.id ? <Check size={18}/> : <ChevronRight size={16}/>}</button>)}</div>
        {!visible.length && <p className={styles.empty}>{view.complete ? "Everyone in the draft pool has been selected." : "No players match this search."}</p>}
        {group === "Injured / Student Assistants" && <p className={styles.caption}>Kept separate from the active draft pool, as listed on your sheet.</p>}
        {chosen && <div className={styles.selection}><div><small>YOUR SELECTION · PICK {view.nextPick}</small><strong>{chosen.name}</strong><span>{document.teams[view.nextTeam ?? 0].name}</span></div><button className="btn btn-primary" disabled={blocked || setup} onClick={() => commit(nextDraftSelection(document, chosen.id))}>{pending ? "Saving…" : "Confirm Pick"}<ChevronRight size={16}/></button></div>}
      </section>
      <div className={styles.teams} aria-label="Drafted team rosters">{document.teams.map((team, index) => <section className={styles.team} data-team={index} key={index} aria-label={`${team.name} roster`}>
        <header><span className={styles.teamNumber}>0{index + 1}</span><div><p className={styles.eyebrow}>{!view.complete && view.nextTeam === index && view.pool.length ? "ON THE CLOCK" : "BOXER WORLD SERIES"}</p><h3>{team.name}</h3></div><strong className={styles.teamCount}>{view.rosters[index].length + team.captains.length}<small>players</small></strong></header>
        <div className={styles.captains}><small>CAPTAINS</small><strong>{team.captains.join(" · ") || "Add captains in Draft Setup"}</strong></div>
        <DraftDepthChart document={document} team={index as 0 | 1} disabled={blocked || setup} onSave={next => commit(next)}/>
        <div className={styles.balance}>{DRAFT_GROUPS.filter(g => g !== "Injured / Student Assistants").map(g => <span key={g}><strong>{view.rosters[index].filter(r => r.player.group === g).length}</strong>{g === "First Base" ? "1B" : g === "Two-Ways" ? "2-Way" : g === "Pitchers" ? "P" : g === "Outfielders" ? "OF" : g === "Infielders" ? "IF" : "C"}</span>)}</div>
        <details className={styles.fullRoster}><summary>Full Roster · {view.rosters[index].length} drafted</summary><ol className={styles.roster}>{view.rosters[index].map(row => <li key={row.player.id}><span className={styles.pickNo}>#{String(row.pick).padStart(2, "0")}</span><div><strong>{playerName(row.player)}</strong><small>{row.player.positions || row.player.group}</small></div></li>)}</ol>
        {!view.rosters[index].length && <p className={styles.empty}>Your picks will fill in here.</p>}</details>
      </section>)}</div>
    </div>
    <section className={styles.board} hidden={bigBoard} aria-label="Complete draft order"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>EVERY PICK · IN ORDER</p><h3>Draft Board</h3></div>{document.picks.length > 0 && <button className="btn btn-secondary" disabled={blocked || setup} onClick={() => setUndo(!undo)}><Undo2 size={15}/>Undo Last Pick</button>}</div>
      {undo && <div className={styles.undo}><span>Return {view.selections.at(-1)?.player.name} to the available pool?</span><button className="btn btn-primary" disabled={blocked} onClick={() => commit(withDraftPicks(document, document.picks.slice(0, -1)))}>Confirm Undo</button><button className="btn btn-secondary" disabled={blocked} onClick={() => setUndo(false)}><X size={14}/>Cancel</button></div>}
      <div className={styles.boardGrid}><div className={styles.boardHeading}>Round</div>{document.teams.map((t, i) => <div className={styles.boardHeading} data-team={i} key={i}>{t.name}</div>)}{view.rounds.map((round, index) => <div className={styles.round} key={index}><span className={styles.roundNumber}>{String(index + 1).padStart(2, "0")}</span>{round.map((slot, team) => <div key={team} className={styles.slot} data-team={team} data-current={!view.complete && slot?.pick === view.nextPick}><span>{slot ? `#${String(slot.pick).padStart(2, "0")}` : "—"}</span><div><strong>{slot?.player ? playerName(slot.player) : slot?.pick === view.nextPick ? "On the Clock" : "—"}</strong>{slot?.player && <small>{slot.player.positions || slot.player.group}</small>}</div>{slot?.player && <Check size={15}/>}</div>)}</div>)}</div>
    </section>
    <p className={styles.caption}>Private to your account. Picks are saved after confirmation. Draft changes never alter player profiles or team access.</p>
    <button type="button" className={styles.refresh} disabled={blocked} onClick={() => window.location.reload()}>Reload Saved Board</button>
  </div>;
}

function DraftSetup({ document, athletes, disabled, onSave, onError }: { document: DraftDocument; athletes: { id: string; name: string }[]; disabled: boolean; onSave: (value: DraftDocument) => void; onError: (value: string) => void }) {
  const [title, setTitle] = useState(document.title), [teams, setTeams] = useState(document.teams), [confirmed, setConfirmed] = useState(false);
  const initialGroups = Object.fromEntries(DRAFT_GROUPS.map(g => [g, document.players.filter(p => p.group === g).map(p => `${p.name}${p.positions ? ` | ${p.positions}` : ""}`).join("\n")])) as Record<DraftGroup, string>;
  const [groups, setGroups] = useState(initialGroups), [base, setBase] = useState(document);
  const [athlete, setAthlete] = useState(""), [addGroup, setAddGroup] = useState<DraftGroup>("Pitchers");
  function importDocument(raw: string) {
    try {
      const next = validateDraftDocument(JSON.parse(raw));
      if (next.picks.length) throw new Error("Import an undrafted setup. Existing picks cannot be replaced here.");
      setTitle(next.title); setTeams(next.teams); setBase(next); setGroups(Object.fromEntries(DRAFT_GROUPS.map(g => [g, next.players.filter(p => p.group === g).map(p => `${p.name}${p.positions ? ` | ${p.positions}` : ""}`).join("\n")])) as Record<DraftGroup, string>); setConfirmed(false); onError("");
    } catch (e) { onError(e instanceof Error ? e.message : "This draft setup file could not be read."); }
  }
  return <section className={styles.setup} aria-label="Draft setup"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>YOUR DRAFT SHEET</p><h3>Draft Setup</h3></div><span>Two teams · Snake order</span></div>
    {document.picks.length > 0 && <p className="notice">The pool and captains are locked once picks begin. Undo the picks first if the setup needs to change.</p>}
    <fieldset disabled={disabled}><label>Draft Title<input value={title} maxLength={100} onChange={e => { setTitle(e.target.value); setConfirmed(false); }}/></label><div className={styles.setupTeams}>{teams.map((team, index) => <div key={index}><label>Team {index + 1} Name<input value={team.name} maxLength={40} onChange={e => { setTeams(teams.map((t, i) => i === index ? { ...t, name: e.target.value } : t) as typeof teams); setConfirmed(false); }}/></label><label>Captains · One per line<textarea rows={2} value={team.captains.join("\n")} onChange={e => { setTeams(teams.map((t, i) => i === index ? { ...t, captains: e.target.value.split("\n") } : t) as typeof teams); setConfirmed(false); }}/></label></div>)}</div>
      <p className={styles.caption}>Saving setup resets field assignments. One player per line. Add a position after a bar: Player Name | OF. Captains are already on their teams and should not appear in the pool.</p>
      <div className={styles.setupGroups}>{DRAFT_GROUPS.map(g => <label key={g}>{g}<textarea rows={g === "Pitchers" ? 7 : 4} value={groups[g]} onChange={e => { setGroups({ ...groups, [g]: e.target.value }); setConfirmed(false); }}/></label>)}</div>
      <details><summary>Add from dashboard roster</summary><div className={styles.addPlayer}><label>Existing Player<select value={athlete} onChange={e => setAthlete(e.target.value)}><option value="">Choose a player</option>{athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Draft Group<select value={addGroup} onChange={e => setAddGroup(e.target.value as DraftGroup)}>{DRAFT_GROUPS.map(g => <option key={g}>{g}</option>)}</select></label><button type="button" className="btn btn-secondary" disabled={!athlete} onClick={() => {
        const a = athletes.find(a => a.id === athlete); if (!a) return;
        const duplicate = Object.values(groups).some(text => text.split("\n").some(line => line.split("|")[0].trim().toLowerCase() === a.name.toLowerCase()));
        if (duplicate) { onError("That player is already in the pool. Edit their existing line instead."); return; }
        setGroups({ ...groups, [addGroup]: [groups[addGroup], a.name].filter(Boolean).join("\n") }); setBase({ ...base, players: [...base.players, { id: crypto.randomUUID(), name: a.name, group: addGroup, positions: "", athleteId: a.id }] }); setConfirmed(false);
      }}>Add Player</button></div></details>
      <details><summary>Load a prepared draft setup</summary><label className={styles.file}>Draft JSON File<input type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 100000) { onError("The draft setup file is too large."); return; } const input = e.currentTarget; try { importDocument(await file.text()); } catch { onError("This draft setup file could not be read. Please choose it again."); } finally { input.value = ""; } }}/></label></details>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I checked the names, position groups, captains and draft order.</label>
      <button className="btn btn-primary" disabled={!confirmed} onClick={() => {
        try { const players = draftPlayersFromGroups(groups, base.players, () => crypto.randomUUID()); const eligible = players.filter(draftable).map(p=>p.id); const prior = draftPlanning(document).bigBoard.filter(id=>eligible.includes(id)); onSave(validateDraftDocument({ version: 1, title: title.trim(), teams: teams.map(t => ({ name: t.name.trim(), captains: t.captains.map(c => c.trim()).filter(Boolean) })), players, picks: [], planning:{bigBoard:[...prior,...eligible.filter(id=>!prior.includes(id))],placements:[[],[]]} })); }
        catch (e) { onError(e instanceof Error ? e.message : "Check the draft setup."); }
      }}>Save Draft Setup</button>
    </fieldset>
  </section>;
}
