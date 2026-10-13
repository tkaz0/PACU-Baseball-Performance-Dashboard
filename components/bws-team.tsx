"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { saveBwsTeamPlan } from "@/app/(workspace)/admin/bws-team/actions";
import { BWS_LIMITS, BWS_POSITIONS, emptyBwsPlan, formatOuts, normalizeBwsPlan, lineupIssues, parseInnings, pitcherUsage, withoutPlayer, type BwsGame, type BwsLineup, type BwsPlayer, type BwsPosition, type BwsRole, type BwsSnapshot, type BwsTeamPlan } from "@/lib/bws-team";
import type { BwsPlayerStats, BwsStat } from "@/lib/bws-team-server";
import styles from "./bws-team.module.css";

type Tab = "roster" | "depth" | "lineups" | "pitching" | "notes";
const TABS: { id: Tab; label: string }[] = [{ id: "roster", label: "Roster" }, { id: "depth", label: "Depth Chart" }, { id: "lineups", label: "Lineups" }, { id: "pitching", label: "Pitching Plan" }, { id: "notes", label: "Notes" }];
const ROLE_LABEL: Record<BwsRole, string> = { pitcher: "Pitcher", position: "Position", two_way: "Two-Way" };
const newId = () => crypto.randomUUID();
const move = <T,>(list: T[], index: number, delta: number) => { const next = [...list], target = index + delta; if (target < 0 || target >= list.length) return list; [next[index], next[target]] = [next[target], next[index]]; return next; };
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function BwsTeam({ initial, athletes, stats, today }: { initial: BwsSnapshot | null; athletes: { id: string; name: string }[]; stats: BwsPlayerStats[] | null; today: string }) {
  const [saved, setSaved] = useState(initial);
  const [plan, setPlan] = useState<BwsTeamPlan>(initial?.document ?? emptyBwsPlan());
  const [tab, setTab] = useState<Tab>("roster");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<{ requestId: string; document: BwsTeamPlan } | null>(null);
  const [saving, setSaving] = useState(false);
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
    {tab === "roster" && <Roster plan={plan} update={update} athletes={athletes} statsFor={statsFor}/>}
    {tab === "depth" && <Depth plan={plan} update={update} byId={byId}/>}
    {tab === "lineups" && <Lineups plan={plan} update={update} byId={byId} statsFor={statsFor}/>}
    {tab === "pitching" && <Pitching plan={plan} update={update} byId={byId} statsFor={statsFor} today={today}/>}
    {tab === "notes" && <Notes plan={plan} update={update}/>}
  </div>;
}

type Shared = { plan: BwsTeamPlan; update: (next: BwsTeamPlan) => void };
function StatCells({ stats, keys }: { stats: BwsStat[] | undefined; keys: string[] }) {
  return <>{keys.map(key => { const s = stats?.find(x => x.key === key); return <td key={key} className={styles.num} title={s?.sample ?? undefined}>{s?.value ?? "—"}</td>; })}</>;
}
const HIT_KEYS = ["batting_production_plus", "batting_ops", "batting_obp", "qpa_pct"], HIT_LABELS = ["PAC Prod+", "OPS", "OBP", "QPA%"];
const PITCH_KEYS = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct"], PITCH_LABELS = ["WHIP", "K/BB", "Runs/9", "Strike %"];

function Roster({ plan, update, athletes, statsFor }: Shared & { athletes: { id: string; name: string }[]; statsFor: Map<string, BwsPlayerStats> }) {
  const [choice, setChoice] = useState(""), [role, setRole] = useState<BwsRole>("position"), [custom, setCustom] = useState("");
  const linked = new Set(plan.players.flatMap(p => p.athleteId ? [p.athleteId] : []));
  const options = athletes.filter(a => !linked.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  const full = plan.players.length >= BWS_LIMITS.players;
  const add = (player: BwsPlayer) => { if (plan.players.some(p => p.name.toLowerCase() === player.name.toLowerCase())) return; update({ ...plan, players: [...plan.players, player] }); };
  const defaultRole = (athleteId: string): BwsRole => { const s = statsFor.get(athleteId); const t = s?.playerType.trim().toLowerCase(); return t === "two_way" ? "two_way" : t === "pitcher" || [s?.position, s?.secondaryPosition].some(p => p?.trim().toUpperCase() === "P") ? "pitcher" : "position"; };
  const groups: { title: string; rows: BwsPlayer[]; hit: boolean; pitch: boolean }[] = [
    { title: "Position Players", rows: plan.players.filter(p => p.role === "position"), hit: true, pitch: false },
    { title: "Two-Way", rows: plan.players.filter(p => p.role === "two_way"), hit: true, pitch: true },
    { title: "Pitchers", rows: plan.players.filter(p => p.role === "pitcher"), hit: false, pitch: true },
  ];
  return <section className={styles.panel} aria-label="Roster">
    <div className={styles.addRow}>
      <select aria-label="Add a rostered player" value={choice} disabled={full} onChange={e => { setChoice(e.target.value); if (e.target.value) setRole(defaultRole(e.target.value)); }}><option value="">Add a rostered player…</option>{options.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select aria-label="Role" value={role} onChange={e => setRole(e.target.value as BwsRole)}>{(Object.keys(ROLE_LABEL) as BwsRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <button type="button" className="btn btn-secondary" disabled={!choice || full} onClick={() => { const a = athletes.find(x => x.id === choice); if (a) add({ id: newId(), name: a.name, athleteId: a.id, role }); setChoice(""); }}><Plus size={15}/>Add</button>
      <input aria-label="Player not on the dashboard roster" placeholder="Or type a name not on the roster" value={custom} maxLength={80} onChange={e => setCustom(e.target.value)}/>
      <button type="button" className="btn btn-secondary" disabled={!custom.trim() || full} onClick={() => { add({ id: newId(), name: custom.trim(), athleteId: null, role }); setCustom(""); }}><Plus size={15}/>Add Name</button>
    </div>
    {!plan.players.length && <p className={styles.note}>Add your drafted players. Linked players show their Fall game stats; typed names are planning-only.</p>}
    {groups.filter(g => g.rows.length).map(group => <div key={group.title} className={styles.group}><h3>{group.title} <small>{group.rows.length}</small></h3>
      <div className="table-wrap"><table className={styles.table}><thead><tr><th>Player</th><th>Role</th>{group.hit && HIT_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}{group.pitch && PITCH_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}<th aria-label="Remove"/></tr></thead>
        <tbody>{group.rows.map(p => { const s = p.athleteId ? statsFor.get(p.athleteId) : undefined; return <tr key={p.id}>
          <th scope="row">{p.athleteId ? <Link prefetch={false} href={`/athletes/${p.athleteId}`}>{p.name}</Link> : <>{p.name} <small className={styles.muted}>not linked</small></>}</th>
          <td><select aria-label={`${p.name} role`} value={p.role} onChange={e => { const r = e.target.value as BwsRole; const next = { ...plan, players: plan.players.map(x => x.id === p.id ? { ...x, role: r } : x) }; update(r === "position" ? { ...next, games: next.games.map(g => ({ ...g, pitchers: g.pitchers.filter(x => x.playerId !== p.id) })) } : next); }}>{(Object.keys(ROLE_LABEL) as BwsRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
          {group.hit && <StatCells stats={s?.hitting} keys={HIT_KEYS}/>}{group.pitch && <StatCells stats={s?.pitching} keys={PITCH_KEYS}/>}
          <td><button type="button" className={styles.iconButton} aria-label={`Remove ${p.name}`} onClick={() => update(withoutPlayer(plan, p.id))}><Trash2 size={15}/></button></td>
        </tr>; })}</tbody></table></div></div>)}
    <p className={styles.note}>Stats are cumulative Fall game-sheet results (hover a value for its sample). Removing a player also removes them from the depth chart, lineups, pitching plan and notes.</p>
  </section>;
}

function PlayerSelect({ label, players, value, onChange, exclude = [] }: { label: string; players: BwsPlayer[]; value: string; onChange: (id: string) => void; exclude?: string[] }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}><option value="">{label}…</option>{players.filter(p => p.id === value || !exclude.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
}

function Depth({ plan, update, byId }: Shared & { byId: Map<string, BwsPlayer> }) {
  const set = (position: BwsPosition, list: string[]) => update({ ...plan, depth: { ...plan.depth, [position]: list } });
  return <section className={styles.panel} aria-label="Depth chart"><div className={styles.depthGrid}>{BWS_POSITIONS.map(position => {
    const list = plan.depth[position];
    const eligible = plan.players.filter(p => position === "DH" || p.role !== "pitcher");
    return <div key={position} className={styles.depthCard} data-position={position}><h3>{position}</h3>
      <ol>{list.map((id, index) => <li key={id}><span className={styles.rank}>{index === 0 ? "Starter" : `Backup ${index}`}</span><strong>{byId.get(id)?.name}</strong>
        <span className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label="Move up" disabled={index === 0} onClick={() => set(position, move(list, index, -1))}><ArrowUp size={14}/></button><button type="button" className={styles.iconButton} aria-label="Move down" disabled={index === list.length - 1} onClick={() => set(position, move(list, index, 1))}><ArrowDown size={14}/></button><button type="button" className={styles.iconButton} aria-label="Remove" onClick={() => set(position, list.filter(x => x !== id))}><X size={14}/></button></span></li>)}</ol>
      {list.length < BWS_LIMITS.depthPerPosition && <PlayerSelect label={`Add to ${position}`} players={eligible} value="" exclude={list} onChange={id => id && set(position, [...list, id])}/>}
    </div>; })}</div><p className={styles.note}>Two-way players and utility players can be listed at more than one position. Pitcher-only players appear only for DH.</p></section>;
}

function Lineups({ plan, update, byId, statsFor }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats> }) {
  const [selected, setSelected] = useState(plan.lineups[0]?.id ?? "");
  const lineup = plan.lineups.find(l => l.id === selected) ?? plan.lineups[0] ?? null;
  const setLineup = (next: BwsLineup) => update({ ...plan, lineups: plan.lineups.map(l => l.id === next.id ? next : l) });
  const create = (fromDepth: boolean) => {
    const name = `Lineup ${plan.lineups.length + 1}`, used = new Set<string>();
    const slots = fromDepth ? BWS_POSITIONS.flatMap(position => { const id = plan.depth[position].find(x => !used.has(x)); if (!id) return []; used.add(id); return [{ playerId: id, position }]; }) : [];
    const created = { id: newId(), name, slots };
    update({ ...plan, lineups: [...plan.lineups, created] }); setSelected(created.id);
  };
  const batters = plan.players;
  return <section className={styles.panel} aria-label="Lineups">
    <div className={styles.addRow}>
      {plan.lineups.length > 0 && <select aria-label="Choose lineup" value={lineup?.id ?? ""} onChange={e => setSelected(e.target.value)}>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(true)}><Plus size={15}/>New from Depth Chart</button>
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(false)}><Plus size={15}/>Blank Lineup</button>
      {lineup && <button type="button" className="btn btn-secondary" onClick={() => window.print()}><Printer size={15}/>Print Lineup Card</button>}
    </div>
    {!lineup ? <p className={styles.note}>Create a lineup from your depth chart starters or start blank. New from Depth Chart fills each position with its first available starter; set the batting order next.</p> : <>
      <div className={styles.addRow}>
        <input aria-label="Lineup name" value={lineup.name} maxLength={40} onChange={e => setLineup({ ...lineup, name: e.target.value })}/>
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
      <LineupCard lineup={lineup} plan={plan} byId={byId}/>
    </>}
  </section>;
}

/** Print-only card; everything else is hidden when printing. */
function LineupCard({ lineup, plan, byId }: { lineup: BwsLineup; plan: BwsTeamPlan; byId: Map<string, BwsPlayer> }) {
  const inLineup = new Set(lineup.slots.map(s => s.playerId));
  const bench = plan.players.filter(p => p.role !== "pitcher" && !inLineup.has(p.id));
  const pitchers = plan.players.filter(p => p.role !== "position");
  return <div className={styles.printCard} aria-hidden="true">
    <h2>{plan.name}</h2><p>{lineup.name}</p>
    <table><thead><tr><th>#</th><th>Player</th><th>Pos</th></tr></thead><tbody>{lineup.slots.map((s, i) => <tr key={s.playerId}><td>{i + 1}</td><td>{byId.get(s.playerId)?.name}</td><td>{s.position}</td></tr>)}</tbody></table>
    <div className={styles.printColumns}><div><h3>Bench</h3><ul>{bench.map(p => <li key={p.id}>{p.name}</li>)}</ul></div><div><h3>Pitchers</h3><ul>{pitchers.map(p => <li key={p.id}>{p.name}</li>)}</ul></div></div>
  </div>;
}

function Pitching({ plan, update, byId, statsFor, today }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats>; today: string }) {
  const [date, setDate] = useState(today), [opponent, setOpponent] = useState("");
  const pitchers = plan.players.filter(p => p.role !== "position");
  const usage = pitcherUsage(plan, today);
  const setGame = (game: BwsGame) => update({ ...plan, games: plan.games.map(g => g.id === game.id ? game : g) });
  const validDate = /^2026-(0[89]|1[0-2])-\d{2}$/.test(date);
  return <section className={styles.panel} aria-label="Pitching plan">
    <h3>Staff Usage</h3>
    {!pitchers.length ? <p className={styles.note}>Mark players as Pitcher or Two-Way on the Roster tab to plan innings.</p> :
    <div className="table-wrap"><table className={styles.table}><thead><tr><th>Pitcher</th><th className={styles.num}>Apps</th><th className={styles.num}>BWS IP</th><th>Last Outing</th><th className={styles.num}>Planned Ahead</th>{PITCH_LABELS.map(l => <th key={l} className={styles.num}>Fall {l}</th>)}</tr></thead>
      <tbody>{usage.map(u => { const s = u.player.athleteId ? statsFor.get(u.player.athleteId) : undefined; return <tr key={u.player.id}>
        <th scope="row">{u.player.name}</th><td className={styles.num}>{u.appearances}</td><td className={styles.num}>{formatOuts(u.totalOuts)}</td>
        <td>{u.last ? <>{shortDate(u.last.date)} · {formatOuts(u.last.actual ?? u.last.planned)} IP{u.last.pitches !== null ? ` · ${u.last.pitches} pitches` : ""} <small className={styles.muted}>{u.daysSinceLast === 0 ? "today" : `${u.daysSinceLast} day${u.daysSinceLast === 1 ? "" : "s"} ago`}</small></> : <span className={styles.muted}>None yet</span>}</td>
        <td className={styles.num}>{u.plannedUpcoming ? formatOuts(u.plannedUpcoming) : "—"}</td><StatCells stats={s?.pitching} keys={PITCH_KEYS}/>
      </tr>; })}</tbody></table></div>}
    <h3>Games</h3>
    <div className={styles.addRow}>
      <input type="date" aria-label="Game date" value={date} min="2026-08-01" max="2026-12-31" onChange={e => setDate(e.target.value)}/>
      <input aria-label="Opponent" placeholder="Opponent (optional)" value={opponent} maxLength={60} onChange={e => setOpponent(e.target.value)}/>
      <button type="button" className="btn btn-secondary" disabled={!validDate || plan.games.length >= BWS_LIMITS.games} onClick={() => { update({ ...plan, games: [...plan.games, { id: newId(), date, opponent: opponent.trim(), lineupId: plan.lineups[0]?.id ?? null, pitchers: [], notes: "" }].sort((a, b) => a.date.localeCompare(b.date)) }); setOpponent(""); }}><Plus size={15}/>Add Game</button>
    </div>
    {!plan.games.length && <p className={styles.note}>Add each BWS game, then plan who pitches and for how many innings. After the game, record actual innings and pitch counts so the usage table stays accurate.</p>}
    <div className={styles.games}>{plan.games.map(game => { const planned = game.pitchers.reduce((sum, p) => sum + p.plannedOuts, 0); return <article key={game.id} className={styles.game} data-past={game.date < today}>
      <header><strong>{shortDate(game.date)}{game.opponent ? ` vs ${game.opponent}` : ""}</strong><span className={styles.muted}>{formatOuts(planned)} IP planned</span>
        <select aria-label="Lineup for this game" value={game.lineupId ?? ""} onChange={e => setGame({ ...game, lineupId: e.target.value || null })}><option value="">No lineup</option>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button type="button" className={styles.iconButton} aria-label="Delete game" onClick={() => update({ ...plan, games: plan.games.filter(g => g.id !== game.id) })}><Trash2 size={15}/></button></header>
      <table className={styles.table}><thead><tr><th>Pitcher</th><th className={styles.num}>Planned IP</th><th className={styles.num}>Actual IP</th><th className={styles.num}>Pitches</th><th aria-label="Order"/></tr></thead>
        <tbody>{game.pitchers.map((p, index) => <tr key={p.playerId}>
          <th scope="row">{byId.get(p.playerId)?.name}</th>
          <td className={styles.num}><InningsInput label="Planned innings" value={p.plannedOuts} onChange={v => v !== null && setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, plannedOuts: v } : x) })}/></td>
          <td className={styles.num}><InningsInput label="Actual innings" value={p.actualOuts} allowEmpty onChange={v => setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, actualOuts: v } : x) })}/></td>
          <td className={styles.num}><input className={styles.small} inputMode="numeric" aria-label="Pitch count" value={p.pitches ?? ""} onChange={e => { const v = e.target.value.trim(); if (v === "" || /^\d{1,3}$/.test(v) && Number(v) <= 200) setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, pitches: v === "" ? null : Number(v) } : x) }); }}/></td>
          <td><span className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label="Earlier" disabled={index === 0} onClick={() => setGame({ ...game, pitchers: move(game.pitchers, index, -1) })}><ArrowUp size={14}/></button><button type="button" className={styles.iconButton} aria-label="Later" disabled={index === game.pitchers.length - 1} onClick={() => setGame({ ...game, pitchers: move(game.pitchers, index, 1) })}><ArrowDown size={14}/></button><button type="button" className={styles.iconButton} aria-label="Remove pitcher" onClick={() => setGame({ ...game, pitchers: game.pitchers.filter((_, i) => i !== index) })}><X size={14}/></button></span></td>
        </tr>)}</tbody></table>
      {game.pitchers.length < BWS_LIMITS.pitchersPerGame && <PlayerSelect label="Add pitcher" players={pitchers} value="" exclude={game.pitchers.map(p => p.playerId)} onChange={id => id && setGame({ ...game, pitchers: [...game.pitchers, { playerId: id, plannedOuts: 3, actualOuts: null, pitches: null }] })}/>}
      <textarea aria-label="Game notes" placeholder="Game notes" value={game.notes} maxLength={BWS_LIMITS.note} onChange={e => setGame({ ...game, notes: e.target.value })}/>
    </article>; })}</div>
    <p className={styles.note}>Innings use baseball notation (4.2 = 4 innings and 2 outs). BWS IP counts actual innings when recorded, otherwise the plan, for games on or before today. Rest and pitch-count limits are your call; nothing here sets them.</p>
  </section>;
}

function InningsInput({ label, value, onChange, allowEmpty = false }: { label: string; value: number | null; onChange: (outs: number | null) => void; allowEmpty?: boolean }) {
  const [draft, setDraft] = useState(value === null ? "" : formatOuts(value));
  const valid = (allowEmpty && draft.trim() === "") || parseInnings(draft) !== null;
  return <input className={styles.small} inputMode="decimal" aria-label={label} aria-invalid={!valid} value={draft} onChange={e => { setDraft(e.target.value); const v = e.target.value.trim(); if (allowEmpty && v === "") onChange(null); else { const outs = parseInnings(v); if (outs !== null) onChange(outs); } }}/>;
}

function Notes({ plan, update }: Shared) {
  const text = (id: string) => plan.notes.find(n => n.playerId === id)?.text ?? "";
  const set = (id: string, value: string) => { const rest = plan.notes.filter(n => n.playerId !== id); update({ ...plan, notes: value.trim() ? [...rest, { playerId: id, text: value }] : rest }); };
  return <section className={styles.panel} aria-label="Player notes">
    {!plan.players.length ? <p className={styles.note}>Add players first.</p> : <div className={styles.notes}>{plan.players.map(p => <label key={p.id}><span>{p.name} <small className={styles.muted}>{ROLE_LABEL[p.role]}</small></span><textarea value={text(p.id)} maxLength={BWS_LIMITS.note} placeholder="Role, matchups, reminders…" onChange={e => set(p.id, e.target.value)}/></label>)}</div>}
    <p className={styles.note}>Notes are private to your account and are never shown to players.</p>
  </section>;
}
