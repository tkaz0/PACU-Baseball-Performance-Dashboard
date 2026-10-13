"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { saveBwsTeamPlan } from "@/app/(workspace)/admin/bws-team/actions";
import { BWS_LIMITS, BWS_POSITIONS, emptyBwsPlan, formatOuts, lineupIssues, normalizeBwsPlan, parseInnings, planCoverage, suggestedOrder, withoutPlayer, type BwsGame, type BwsLineup, type BwsPlayer, type BwsPosition, type BwsRole, type BwsSnapshot, type BwsTeamPlan } from "@/lib/bws-team";
import type { BwsPlayerStats, BwsStat } from "@/lib/bws-team-server";
import styles from "./bws-team.module.css";

type Tab = "games" | "lineups" | "depth" | "roster" | "scouting";
const TABS: { id: Tab; label: string }[] = [{ id: "games", label: "Games" }, { id: "lineups", label: "Lineups" }, { id: "depth", label: "Depth Chart" }, { id: "roster", label: "Roster" }, { id: "scouting", label: "Scouting" }];
type PrintTarget = { kind: "lineup"; id: string } | { kind: "game"; id: string } | null;
const ROLE_LABEL: Record<BwsRole, string> = { pitcher: "Pitcher", position: "Position", two_way: "Two-Way" };
const newId = () => crypto.randomUUID();
const move = <T,>(list: T[], index: number, delta: number) => { const next = [...list], target = index + delta; if (target < 0 || target >= list.length) return list; [next[index], next[target]] = [next[target], next[index]]; return next; };
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const HIT_KEYS = ["batting_production_plus", "batting_ops", "batting_obp", "qpa_pct"], HIT_LABELS = ["PAC Prod+", "OPS", "OBP", "QPA%"];
const PITCH_KEYS = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct"], PITCH_LABELS = ["WHIP", "K/BB", "Runs/9", "Strike %"];

export function BwsTeam({ initial, athletes, stats, today }: { initial: BwsSnapshot | null; athletes: { id: string; name: string }[]; stats: BwsPlayerStats[] | null; today: string }) {
  const [saved, setSaved] = useState(initial);
  const [plan, setPlan] = useState<BwsTeamPlan>(initial?.document ?? emptyBwsPlan());
  const [tab, setTab] = useState<Tab>("games");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<{ requestId: string; document: BwsTeamPlan } | null>(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState<PrintTarget>(null);
  // Render the chosen print sheet, open the print dialog, then clear it.
  useEffect(() => { if (!printing) return; const done = () => setPrinting(null); window.addEventListener("afterprint", done, { once: true }); const timer = window.setTimeout(() => window.print(), 50); return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", done); }; }, [printing]);
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved?.document ?? emptyBwsPlan());
  const statsFor = useMemo(() => new Map((stats ?? []).map(s => [s.athleteId, s])), [stats]);
  const byId = useMemo(() => new Map(plan.players.map(p => [p.id, p])), [plan.players]);
  const update = (next: BwsTeamPlan) => { setPlan(next); setStatus(null); };

  async function save() {
    // An uncertain save keeps the same request so a retry can never apply a different change twice.
    const document = normalizeBwsPlan(plan);
    const attempt = pending && JSON.stringify(pending.document) === JSON.stringify(document) ? pending : { requestId: newId(), document };
    setPending(attempt); setSaving(true);
    const result = await saveBwsTeamPlan({ requestId: attempt.requestId, expectedRevision: saved?.revision ?? 0, document: attempt.document }).catch(() => ({ ok: false as const, message: "The save was not confirmed. Retry this same change or reload to check it." }));
    setSaving(false);
    if (result.ok) { setSaved(result.plan); setPlan(result.plan.document); setPending(null); setStatus({ tone: "ok", text: "Saved." }); }
    else setStatus({ tone: "error", text: result.message });
  }

  return <div className={styles.wrap}>
    <div className={styles.toolbar}>
      <input className={styles.teamName} aria-label="Team name" value={plan.name} maxLength={60} onChange={e => update({ ...plan, name: e.target.value })}/>
      <span className={styles.meta}>{plan.players.length} players{saved ? ` · Saved ${new Date(saved.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : " · Not saved yet"}</span>
      <button type="button" className="btn btn-primary" disabled={!dirty || saving || !plan.name.trim()} onClick={save}><Save size={15}/>{saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}</button>
      {dirty && <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => { setPlan(saved?.document ?? emptyBwsPlan()); setPending(null); setStatus(null); }}>Discard</button>}
    </div>
    {status && <p role="status" className={styles.status} data-tone={status.tone}>{status.text}</p>}
    {stats === null && <p role="status" className={styles.note}>Game stats are temporarily unavailable. Planning still works.</p>}
    <div className={styles.tabs} role="tablist">{TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={styles.tab} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    {tab === "games" && <Games plan={plan} update={update} byId={byId} statsFor={statsFor} today={today} onPrint={id => setPrinting({ kind: "game", id })} openLineups={() => setTab("lineups")}/>}
    {tab === "lineups" && <Lineups plan={plan} update={update} byId={byId} statsFor={statsFor} onPrint={id => setPrinting({ kind: "lineup", id })}/>}
    {tab === "depth" && <Depth plan={plan} update={update} byId={byId}/>}
    {tab === "roster" && <Roster plan={plan} update={update} athletes={athletes} statsFor={statsFor}/>}
    {tab === "scouting" && <Scouting plan={plan} stats={stats}/>}
    {printing?.kind === "lineup" && plan.lineups.some(l => l.id === printing.id) && <LineupCard lineup={plan.lineups.find(l => l.id === printing.id)!} plan={plan} byId={byId}/>}
    {printing?.kind === "game" && plan.games.some(g => g.id === printing.id) && <GameSheet game={plan.games.find(g => g.id === printing.id)!} plan={plan} byId={byId}/>}
  </div>;
}

type Shared = { plan: BwsTeamPlan; update: (next: BwsTeamPlan) => void };
function StatCells({ stats, keys }: { stats: BwsStat[] | undefined; keys: string[] }) {
  return <>{keys.map(key => { const s = stats?.find(x => x.key === key); return <td key={key} className={styles.num} title={s?.sample ?? undefined}>{s?.value ?? "—"}</td>; })}</>;
}
function PlayerSelect({ label, players, value, onChange, exclude = [] }: { label: string; players: BwsPlayer[]; value: string; onChange: (id: string) => void; exclude?: string[] }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}><option value="">{label}…</option>{players.filter(p => p.id === value || !exclude.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
}

/** The main planning view: each game's lineup and pitchers, with a simple who's-covered strip. */
function Games({ plan, update, byId, statsFor, today, onPrint, openLineups }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats>; today: string; onPrint: (id: string) => void; openLineups: () => void }) {
  const [date, setDate] = useState(today);
  const pitchers = plan.players.filter(p => p.role !== "position");
  const coverage = planCoverage(plan);
  const setGame = (game: BwsGame) => update({ ...plan, games: plan.games.map(g => g.id === game.id ? game : g) });
  const validDate = /^2026-(0[89]|1[0-2])-\d{2}$/.test(date);
  const pitcherLine = (id: string) => { const p = byId.get(id); const s = p?.athleteId ? statsFor.get(p.athleteId) : undefined; const whip = s?.pitching.find(x => x.key === "pitching_whip")?.value, kbb = s?.pitching.find(x => x.key === "pitching_k_bb")?.value; return [whip && `${whip} WHIP`, kbb && `${kbb} K/BB`].filter(Boolean).join(" · "); };
  return <section className={styles.panel} aria-label="Games">
    <div className={styles.coverage}>
      <div><h3>Batters <small>games in a lineup</small></h3><ul className={styles.chips}>{coverage.batters.map(b => <li key={b.player.id} data-empty={b.games === 0}>{b.player.name}<strong>{b.games}</strong></li>)}</ul></div>
      <div><h3>Pitchers <small>planned innings</small></h3><ul className={styles.chips}>{coverage.pitchers.map(p => <li key={p.player.id} data-empty={p.outs === 0}>{p.player.name}<strong>{formatOuts(p.outs)}</strong></li>)}</ul></div>
    </div>
    <div className={styles.games}>{plan.games.map((game, number) => { const lineup = plan.lineups.find(l => l.id === game.lineupId); const planned = game.pitchers.reduce((sum, p) => sum + p.plannedOuts, 0); return <article key={game.id} className={styles.game} data-past={game.date < today}>
      <header><strong>Game {number + 1} · {shortDate(game.date)}</strong>
        <select aria-label="Lineup for this game" value={game.lineupId ?? ""} onChange={e => setGame({ ...game, lineupId: e.target.value || null })}><option value="">Choose lineup…</option>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button type="button" className="btn btn-secondary" onClick={() => onPrint(game.id)}><Printer size={15}/>Game Sheet</button>
        <button type="button" className={styles.iconButton} aria-label="Delete game" onClick={() => update({ ...plan, games: plan.games.filter(g => g.id !== game.id) })}><Trash2 size={15}/></button></header>
      <div className={styles.gameBody}>
        <div><h4>Lineup</h4>{lineup ? <ol className={styles.lineupList}>{lineup.slots.map(s => <li key={s.playerId}><span>{byId.get(s.playerId)?.name}</span><small>{s.position}</small></li>)}</ol>
          : <p className={styles.note}>{plan.lineups.length ? "Choose a lineup above." : <>No lineups yet. <button type="button" className={styles.linkButton} onClick={openLineups}>Build one</button>.</>}</p>}</div>
        <div><h4>Pitchers <small>{formatOuts(planned)} IP</small></h4>
          <ol className={styles.lineupList}>{game.pitchers.map((p, index) => <li key={p.playerId}><span>{byId.get(p.playerId)?.name}<small className={styles.muted}> {pitcherLine(p.playerId)}</small></span>
            <span className={styles.rowActions}><InningsInput label="Planned innings" value={p.plannedOuts} onChange={v => v !== null && setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, plannedOuts: v } : x) })}/><small>IP</small>
              <button type="button" className={styles.iconButton} aria-label="Earlier" disabled={index === 0} onClick={() => setGame({ ...game, pitchers: move(game.pitchers, index, -1) })}><ArrowUp size={14}/></button>
              <button type="button" className={styles.iconButton} aria-label="Remove pitcher" onClick={() => setGame({ ...game, pitchers: game.pitchers.filter((_, i) => i !== index) })}><X size={14}/></button></span></li>)}</ol>
          {game.pitchers.length < BWS_LIMITS.pitchersPerGame && <PlayerSelect label="Add pitcher" players={pitchers} value="" exclude={game.pitchers.map(p => p.playerId)} onChange={id => id && setGame({ ...game, pitchers: [...game.pitchers, { playerId: id, plannedOuts: 6, actualOuts: null, pitches: null, battersFaced: null }] })}/>}
        </div>
      </div>
      <textarea aria-label="Game notes" placeholder="Notes for this game" value={game.notes} maxLength={BWS_LIMITS.note} onChange={e => setGame({ ...game, notes: e.target.value })}/>
    </article>; })}</div>
    <div className={styles.addRow}>
      <input type="date" aria-label="Game date" value={date} min="2026-08-01" max="2026-12-31" onChange={e => setDate(e.target.value)}/>
      <button type="button" className="btn btn-secondary" disabled={!validDate || plan.games.length >= BWS_LIMITS.games} onClick={() => update({ ...plan, games: [...plan.games, { id: newId(), date, opponent: "", lineupId: null, pitchers: [], batters: [], notes: "" }].sort((a, b) => a.date.localeCompare(b.date)) })}><Plus size={15}/>Add Game</button>
    </div>
    <p className={styles.note}>Innings use baseball notation (4.2 = 4 innings and 2 outs). New pitchers start at 2 innings.</p>
  </section>;
}

function InningsInput({ label, value, onChange }: { label: string; value: number; onChange: (outs: number | null) => void }) {
  const [draft, setDraft] = useState(formatOuts(value));
  return <input className={styles.small} inputMode="decimal" aria-label={label} aria-invalid={parseInnings(draft) === null} value={draft} onChange={e => { setDraft(e.target.value); const outs = parseInnings(e.target.value); if (outs !== null) onChange(outs); }}/>;
}

function Lineups({ plan, update, byId, statsFor, onPrint }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats>; onPrint: (id: string) => void }) {
  const [selected, setSelected] = useState(plan.lineups[0]?.id ?? "");
  const lineup = plan.lineups.find(l => l.id === selected) ?? plan.lineups[0] ?? null;
  const setLineup = (next: BwsLineup) => update({ ...plan, lineups: plan.lineups.map(l => l.id === next.id ? next : l) });
  const create = (fromDepth: boolean) => {
    const used = new Set<string>();
    const slots = fromDepth ? BWS_POSITIONS.flatMap(position => { const id = plan.depth[position].find(x => !used.has(x)); if (!id) return []; used.add(id); return [{ playerId: id, position }]; }) : [];
    const created = { id: newId(), name: `Lineup ${plan.lineups.length + 1}`, slots };
    update({ ...plan, lineups: [...plan.lineups, created] }); setSelected(created.id);
  };
  const batters = plan.players.filter(p => p.role !== "pitcher");
  const orderStats = new Map(plan.players.map(p => { const s = p.athleteId ? statsFor.get(p.athleteId) : undefined; const raw = (key: string) => s?.hitting.find(x => x.key === key)?.raw ?? null; return [p.id, { obp: raw("batting_obp"), ops: raw("batting_ops") }]; }));
  return <section className={styles.panel} aria-label="Lineups">
    <div className={styles.addRow}>
      {plan.lineups.length > 0 && <select aria-label="Choose lineup" value={lineup?.id ?? ""} onChange={e => setSelected(e.target.value)}>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(true)}><Plus size={15}/>New from Depth Chart</button>
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(false)}><Plus size={15}/>Blank Lineup</button>
    </div>
    {!lineup ? <p className={styles.note}>New from Depth Chart fills each position with its starter. Make one lineup per game (or reuse one) and pick it on the Games tab.</p> : <>
      <div className={styles.addRow}>
        <input aria-label="Lineup name" value={lineup.name} maxLength={40} onChange={e => setLineup({ ...lineup, name: e.target.value })}/>
        {lineup.slots.length > 1 && <button type="button" className="btn btn-secondary" title="Leadoff = best Fall OBP; then by Fall OPS. Positions stay the same." onClick={() => setLineup({ ...lineup, slots: suggestedOrder(lineup.slots, orderStats) })}>Suggest Order</button>}
        <button type="button" className="btn btn-secondary" onClick={() => onPrint(lineup.id)}><Printer size={15}/>Print</button>
        <button type="button" className={styles.iconButton} aria-label="Delete lineup" onClick={() => { update({ ...plan, lineups: plan.lineups.filter(l => l.id !== lineup.id), games: plan.games.map(g => g.lineupId === lineup.id ? { ...g, lineupId: null } : g) }); setSelected(""); }}><Trash2 size={15}/></button>
      </div>
      <div className="table-wrap"><table className={styles.table}><thead><tr><th>#</th><th>Player</th><th>Pos</th>{HIT_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}<th aria-label="Order"/></tr></thead>
        <tbody>{lineup.slots.map((slot, index) => { const p = byId.get(slot.playerId); const s = p?.athleteId ? statsFor.get(p.athleteId) : undefined; return <tr key={slot.playerId}>
          <td className={styles.num}>{index + 1}</td>
          <td><PlayerSelect label="Batter" players={batters} value={slot.playerId} exclude={lineup.slots.map(x => x.playerId)} onChange={id => id && setLineup({ ...lineup, slots: lineup.slots.map((x, i) => i === index ? { ...x, playerId: id } : x) })}/></td>
          <td><select aria-label="Position" value={slot.position} onChange={e => { const position = e.target.value as BwsPosition; const other = lineup.slots.findIndex(x => x.position === position); setLineup({ ...lineup, slots: lineup.slots.map((x, i) => i === index ? { ...x, position } : i === other ? { ...x, position: slot.position } : x) }); }}>{BWS_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}</select></td>
          <StatCells stats={s?.hitting} keys={HIT_KEYS}/>
          <td><span className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label="Bat earlier" disabled={index === 0} onClick={() => setLineup({ ...lineup, slots: move(lineup.slots, index, -1) })}><ArrowUp size={14}/></button><button type="button" className={styles.iconButton} aria-label="Bat later" disabled={index === lineup.slots.length - 1} onClick={() => setLineup({ ...lineup, slots: move(lineup.slots, index, 1) })}><ArrowDown size={14}/></button><button type="button" className={styles.iconButton} aria-label="Remove batter" onClick={() => setLineup({ ...lineup, slots: lineup.slots.filter((_, i) => i !== index) })}><X size={14}/></button></span></td>
        </tr>; })}</tbody></table></div>
      {lineup.slots.length < 10 && <div className={styles.addRow}><PlayerSelect label="Add batter" players={batters} value="" exclude={lineup.slots.map(x => x.playerId)} onChange={id => { if (!id) return; const open = BWS_POSITIONS.find(pos => !lineup.slots.some(x => x.position === pos)); if (open) setLineup({ ...lineup, slots: [...lineup.slots, { playerId: id, position: open }] }); }}/></div>}
      {lineupIssues(lineup).length > 0 && <p className={styles.warn}>{lineupIssues(lineup).map(i => i.detail).join(" · ")}</p>}
    </>}
  </section>;
}

/** Field positions as percentages of the diagram (home plate at the bottom). */
const FIELD_SPOTS: Record<BwsPosition, { x: number; y: number }> = {
  LF: { x: 17, y: 22 }, CF: { x: 50, y: 9 }, RF: { x: 83, y: 22 }, SS: { x: 34, y: 43 }, "2B": { x: 66, y: 43 },
  "3B": { x: 17, y: 60 }, "1B": { x: 83, y: 60 }, C: { x: 50, y: 88 }, DH: { x: 86, y: 88 },
};
function Depth({ plan, update, byId }: Shared & { byId: Map<string, BwsPlayer> }) {
  const set = (position: BwsPosition, list: string[]) => update({ ...plan, depth: { ...plan.depth, [position]: list } });
  const placed = new Set(BWS_POSITIONS.flatMap(p => plan.depth[p]));
  const unplaced = plan.players.filter(p => p.role !== "pitcher" && !placed.has(p.id));
  const pitchers = plan.players.filter(p => p.role !== "position");
  return <section className={styles.panel} aria-label="Depth chart">
    <div className={styles.field}>
      <svg className={styles.fieldArt} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 97 L2 50 Q50 -8 98 50 Z" className={styles.grass}/>
        <path d="M50 92 L28 70 L50 48 L72 70 Z" className={styles.dirt}/>
        <path d="M50 92 L2 44 M50 92 L98 44" className={styles.lines}/>
      </svg>
      {BWS_POSITIONS.map(position => { const list = plan.depth[position], eligible = plan.players.filter(p => position === "DH" || p.role !== "pitcher"); return <div key={position} className={styles.spot} style={{ left: `${FIELD_SPOTS[position].x}%`, top: `${FIELD_SPOTS[position].y}%` }} data-position={position}>
        <b>{position}</b>
        <ol>{list.map((id, index) => <li key={id} data-starter={index === 0}><span>{byId.get(id)?.name}</span>
          <span className={styles.spotActions}>{index > 0 && <button type="button" aria-label={`Make ${byId.get(id)?.name} the ${position} starter`} onClick={() => set(position, [id, ...list.filter(x => x !== id)])}><ArrowUp size={12}/></button>}<button type="button" aria-label={`Remove ${byId.get(id)?.name} from ${position}`} onClick={() => set(position, list.filter(x => x !== id))}><X size={12}/></button></span></li>)}</ol>
        {list.length < BWS_LIMITS.depthPerPosition && <PlayerSelect label="+ Add" players={eligible} value="" exclude={list} onChange={id => id && set(position, [...list, id])}/>}
      </div>; })}
    </div>
    <div className={styles.benchRow}>
      <div><h3>Not on the field <small>{unplaced.length}</small></h3>{unplaced.length ? <ul className={styles.chips}>{unplaced.map(p => <li key={p.id}>{p.name}</li>)}</ul> : <p className={styles.note}>Every position player is placed.</p>}</div>
      <div><h3>Pitchers <small>{pitchers.length}</small></h3><ul className={styles.chips}>{pitchers.map(p => <li key={p.id}>{p.name}</li>)}</ul></div>
    </div>
    <p className={styles.note}>The first name at each spot is the starter (bold); the arrow makes a backup the starter. A player can be listed at more than one position.</p>
  </section>;
}

function Roster({ plan, update, athletes, statsFor }: Shared & { athletes: { id: string; name: string }[]; statsFor: Map<string, BwsPlayerStats> }) {
  const [choice, setChoice] = useState(""), [role, setRole] = useState<BwsRole>("position"), [custom, setCustom] = useState("");
  const linked = new Set(plan.players.flatMap(p => p.athleteId ? [p.athleteId] : []));
  const options = athletes.filter(a => !linked.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  const full = plan.players.length >= BWS_LIMITS.players;
  const add = (player: BwsPlayer) => { if (plan.players.some(p => p.name.toLowerCase() === player.name.toLowerCase())) return; update({ ...plan, players: [...plan.players, player] }); };
  const defaultRole = (athleteId: string): BwsRole => { const s = statsFor.get(athleteId); const t = s?.playerType.trim().toLowerCase(); return t === "two_way" ? "two_way" : t === "pitcher" || [s?.position, s?.secondaryPosition].some(p => p?.trim().toUpperCase() === "P") ? "pitcher" : "position"; };
  const groups = [
    { title: "Position Players", rows: plan.players.filter(p => p.role === "position"), hit: true, pitch: false },
    { title: "Two-Way", rows: plan.players.filter(p => p.role === "two_way"), hit: true, pitch: true },
    { title: "Pitchers", rows: plan.players.filter(p => p.role === "pitcher"), hit: false, pitch: true },
  ];
  return <section className={styles.panel} aria-label="Roster">
    {groups.filter(g => g.rows.length).map(group => <div key={group.title} className={styles.group}><h3>{group.title} <small>{group.rows.length}</small></h3>
      <div className="table-wrap"><table className={styles.table}><thead><tr><th>Player</th><th>Role</th>{group.hit && HIT_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}{group.pitch && PITCH_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}<th aria-label="Remove"/></tr></thead>
        <tbody>{group.rows.map(p => { const s = p.athleteId ? statsFor.get(p.athleteId) : undefined; return <tr key={p.id}>
          <th scope="row">{p.athleteId ? <Link prefetch={false} href={`/athletes/${p.athleteId}`}>{p.name}</Link> : <>{p.name} <small className={styles.muted}>not linked</small></>}</th>
          <td><select aria-label={`${p.name} role`} value={p.role} onChange={e => { const r = e.target.value as BwsRole; const next = { ...plan, players: plan.players.map(x => x.id === p.id ? { ...x, role: r } : x) }; update(r === "position" ? { ...next, games: next.games.map(g => ({ ...g, pitchers: g.pitchers.filter(x => x.playerId !== p.id) })) } : next); }}>{(Object.keys(ROLE_LABEL) as BwsRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
          {group.hit && <StatCells stats={s?.hitting} keys={HIT_KEYS}/>}{group.pitch && <StatCells stats={s?.pitching} keys={PITCH_KEYS}/>}
          <td><button type="button" className={styles.iconButton} aria-label={`Remove ${p.name}`} onClick={() => update(withoutPlayer(plan, p.id))}><Trash2 size={15}/></button></td>
        </tr>; })}</tbody></table></div></div>)}
    <div className={styles.addRow}>
      <select aria-label="Add a rostered player" value={choice} disabled={full} onChange={e => { setChoice(e.target.value); if (e.target.value) setRole(defaultRole(e.target.value)); }}><option value="">Add a player…</option>{options.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select aria-label="Role" value={role} onChange={e => setRole(e.target.value as BwsRole)}>{(Object.keys(ROLE_LABEL) as BwsRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <button type="button" className="btn btn-secondary" disabled={!choice || full} onClick={() => { const a = athletes.find(x => x.id === choice); if (a) add({ id: newId(), name: a.name, athleteId: a.id, role }); setChoice(""); }}><Plus size={15}/>Add</button>
      <input aria-label="Player not on the dashboard roster" placeholder="Or type a name" value={custom} maxLength={80} onChange={e => setCustom(e.target.value)}/>
      <button type="button" className="btn btn-secondary" disabled={!custom.trim() || full} onClick={() => { add({ id: newId(), name: custom.trim(), athleteId: null, role }); setCustom(""); }}><Plus size={15}/>Add Name</button>
    </div>
    <p className={styles.note}>Fall game-sheet stats; hover a value for its sample.</p>
  </section>;
}

const SCOUT_HIT = ["batting_production_plus", "batting_ops", "batting_obp", "batting_avg", "batting_k_pct", "batting_bb_pct", "batting_est_iso", "sb"], SCOUT_HIT_LABELS = ["PAC Prod+", "OPS", "OBP", "AVG", "K%", "BB%", "ISO", "SB"];
const SCOUT_PITCH = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct", "pitching_k9"], SCOUT_PITCH_LABELS = ["WHIP", "K/BB", "Runs/9", "Strike %", "K/9"];
const playerType = (s: BwsPlayerStats) => s.playerType.trim().toLowerCase();
const isPitcher = (s: BwsPlayerStats) => playerType(s) === "two_way" || playerType(s) === "pitcher" || [s.position, s.secondaryPosition].some(p => p.trim().toUpperCase() === "P");
const isHitter = (s: BwsPlayerStats) => playerType(s) !== "pitcher";
const rawStat = (list: BwsStat[], key: string) => list.find(x => x.key === key)?.raw;
/** The other team is everyone on the current eligible roster who is not on your team. */
function Scouting({ plan, stats }: { plan: BwsTeamPlan; stats: BwsPlayerStats[] | null }) {
  if (!stats) return <section className={styles.panel} aria-label="Scouting"><p className={styles.note}>Stats are temporarily unavailable.</p></section>;
  const mine = new Set(plan.players.flatMap(p => p.athleteId ? [p.athleteId] : []));
  const others = stats.filter(s => !mine.has(s.athleteId));
  const hitters = others.filter(isHitter).sort((a, b) => (rawStat(b.hitting, "batting_ops") ?? -1) - (rawStat(a.hitting, "batting_ops") ?? -1) || a.name.localeCompare(b.name));
  const arms = others.filter(isPitcher).sort((a, b) => (rawStat(a.pitching, "pitching_whip") ?? 99) - (rawStat(b.pitching, "pitching_whip") ?? 99) || a.name.localeCompare(b.name));
  return <section className={styles.panel} aria-label="Scouting">
    <p className={styles.note}>Every eligible Pacific player who isn&apos;t on your BWS team ({others.length} players). Players you added by typed name aren&apos;t linked to a profile, so they can still appear here.</p>
    <h3>Their Hitters <small>{hitters.length} · by OPS</small></h3>
    <div className="table-wrap"><table className={styles.table}><thead><tr><th>Hitter</th><th>Pos</th><th>Bats</th>{SCOUT_HIT_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}</tr></thead>
      <tbody>{hitters.map(s => <tr key={s.athleteId}><th scope="row"><Link prefetch={false} href={`/athletes/${s.athleteId}`}>{s.name}</Link></th><td>{[s.position, s.secondaryPosition].filter(Boolean).join("/") || "—"}</td><td>{s.bats || "—"}</td><StatCells stats={s.hitting} keys={SCOUT_HIT}/></tr>)}</tbody></table></div>
    <h3>Their Pitchers <small>{arms.length} · by WHIP</small></h3>
    <div className="table-wrap"><table className={styles.table}><thead><tr><th>Pitcher</th><th>Throws</th>{SCOUT_PITCH_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}</tr></thead>
      <tbody>{arms.map(s => <tr key={s.athleteId}><th scope="row"><Link prefetch={false} href={`/athletes/${s.athleteId}?tab=pitching`}>{s.name}</Link></th><td>{s.throws || "—"}</td><StatCells stats={s.pitching} keys={SCOUT_PITCH}/></tr>)}</tbody></table></div>
    <p className={styles.note}>Cumulative Fall game-sheet stats; hover a value for its sample. Players without game stats show dashes. Open a name for their full profile.</p>
  </section>;
}

/** Print-only cards; everything else is hidden when printing. */
function LineupCard({ lineup, plan, byId }: { lineup: BwsLineup; plan: BwsTeamPlan; byId: Map<string, BwsPlayer> }) {
  const inLineup = new Set(lineup.slots.map(s => s.playerId));
  return <div className={styles.printCard} aria-hidden="true">
    <h2>{plan.name}</h2><p>{lineup.name}</p>
    <table><thead><tr><th>#</th><th>Player</th><th>Pos</th></tr></thead><tbody>{lineup.slots.map((s, i) => <tr key={s.playerId}><td>{i + 1}</td><td>{byId.get(s.playerId)?.name}</td><td>{s.position}</td></tr>)}</tbody></table>
    <div className={styles.printColumns}><div><h3>Bench</h3><ul>{plan.players.filter(p => p.role !== "pitcher" && !inLineup.has(p.id)).map(p => <li key={p.id}>{p.name}</li>)}</ul></div><div><h3>Pitchers</h3><ul>{plan.players.filter(p => p.role !== "position").map(p => <li key={p.id}>{p.name}</li>)}</ul></div></div>
  </div>;
}
function GameSheet({ game, plan, byId }: { game: BwsGame; plan: BwsTeamPlan; byId: Map<string, BwsPlayer> }) {
  const lineup = plan.lineups.find(l => l.id === game.lineupId), inLineup = new Set(lineup?.slots.map(s => s.playerId) ?? []);
  return <div className={styles.printCard} aria-hidden="true">
    <h2>{plan.name} · Game {plan.games.findIndex(g => g.id === game.id) + 1}</h2><p>{shortDate(game.date)}{lineup ? ` · ${lineup.name}` : ""}</p>
    {lineup && <table><thead><tr><th>#</th><th>Batter</th><th>Pos</th></tr></thead><tbody>{lineup.slots.map((s, i) => <tr key={s.playerId}><td>{i + 1}</td><td>{byId.get(s.playerId)?.name}</td><td>{s.position}</td></tr>)}</tbody></table>}
    <div className={styles.printColumns}>
      <div><h3>Bench</h3><ul>{plan.players.filter(p => p.role !== "pitcher" && !inLineup.has(p.id)).map(p => <li key={p.id}>{p.name}</li>)}</ul></div>
      <div><h3>Pitching Plan</h3><ol>{game.pitchers.map(p => <li key={p.playerId}>{byId.get(p.playerId)?.name} · {formatOuts(p.plannedOuts)} IP</li>)}</ol></div>
    </div>
    {game.notes && <p>{game.notes}</p>}
  </div>;
}
