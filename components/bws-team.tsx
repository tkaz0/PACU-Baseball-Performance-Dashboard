"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { saveBwsTeamPlan } from "@/app/(workspace)/admin/bws-team/actions";
import { BWS_LIMITS, BWS_POSITIONS, emptyBwsPlan, formatOuts, normalizeBwsPlan, lineupIssues, parseInnings, pitcherUsage, seriesRequirements, slotPlateAppearances, suggestedOrder, withoutPlayer, type BwsGame, type BwsRequirementRow, type BwsLineup, type BwsPlayer, type BwsPosition, type BwsRole, type BwsSnapshot, type BwsTeamPlan } from "@/lib/bws-team";
import type { BwsPlayerStats, BwsStat } from "@/lib/bws-team-server";
import styles from "./bws-team.module.css";

type Tab = "series" | "roster" | "depth" | "lineups" | "games" | "scouting" | "notes";
const TABS: { id: Tab; label: string }[] = [{ id: "series", label: "Series" }, { id: "roster", label: "Roster" }, { id: "depth", label: "Depth Chart" }, { id: "lineups", label: "Lineups" }, { id: "games", label: "Games" }, { id: "scouting", label: "Scouting" }, { id: "notes", label: "Notes" }];
type PrintTarget = { kind: "lineup"; id: string } | { kind: "game"; id: string } | null;
const ROLE_LABEL: Record<BwsRole, string> = { pitcher: "Pitcher", position: "Position", two_way: "Two-Way" };
const newId = () => crypto.randomUUID();
const move = <T,>(list: T[], index: number, delta: number) => { const next = [...list], target = index + delta; if (target < 0 || target >= list.length) return list; [next[index], next[target]] = [next[target], next[index]]; return next; };
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function BwsTeam({ initial, athletes, stats, today }: { initial: BwsSnapshot | null; athletes: { id: string; name: string }[]; stats: BwsPlayerStats[] | null; today: string }) {
  const [saved, setSaved] = useState(initial);
  const [plan, setPlan] = useState<BwsTeamPlan>(initial?.document ?? emptyBwsPlan());
  const [tab, setTab] = useState<Tab>("series");
  const [printing, setPrinting] = useState<PrintTarget>(null);
  // Render the chosen print sheet, open the print dialog, then clear it.
  useEffect(() => { if (!printing) return; const done = () => setPrinting(null); window.addEventListener("afterprint", done, { once: true }); const timer = window.setTimeout(() => window.print(), 50); return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", done); }; }, [printing]);
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
    {tab === "series" && <Series plan={plan} update={update} statsFor={statsFor} today={today} onPrint={id => setPrinting({ kind: "game", id })} openGames={() => setTab("games")}/>}
    {tab === "roster" && <Roster plan={plan} update={update} athletes={athletes} statsFor={statsFor}/>}
    {tab === "depth" && <Depth plan={plan} update={update} byId={byId}/>}
    {tab === "lineups" && <Lineups plan={plan} update={update} byId={byId} statsFor={statsFor} onPrint={id => setPrinting({ kind: "lineup", id })}/>}
    {tab === "games" && <Pitching plan={plan} update={update} byId={byId} statsFor={statsFor} today={today} onPrint={id => setPrinting({ kind: "game", id })}/>}
    {tab === "scouting" && <Scouting plan={plan} update={update} athletes={athletes} statsFor={statsFor}/>}
    {tab === "notes" && <Notes plan={plan} update={update}/>}
    {printing?.kind === "lineup" && plan.lineups.some(l => l.id === printing.id) && <LineupCard lineup={plan.lineups.find(l => l.id === printing.id)!} plan={plan} byId={byId}/>}
    {printing?.kind === "game" && plan.games.some(g => g.id === printing.id) && <GameSheet game={plan.games.find(g => g.id === printing.id)!} plan={plan} byId={byId} statsFor={statsFor}/>}
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

function Lineups({ plan, update, byId, statsFor, onPrint }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats>; onPrint: (id: string) => void }) {
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
  const orderStats = new Map(plan.players.map(p => { const s = p.athleteId ? statsFor.get(p.athleteId) : undefined; const raw = (key: string) => s?.hitting.find(x => x.key === key)?.raw ?? null; return [p.id, { obp: raw("batting_obp"), ops: raw("batting_ops") }]; }));
  return <section className={styles.panel} aria-label="Lineups">
    <div className={styles.addRow}>
      {plan.lineups.length > 0 && <select aria-label="Choose lineup" value={lineup?.id ?? ""} onChange={e => setSelected(e.target.value)}>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(true)}><Plus size={15}/>New from Depth Chart</button>
      <button type="button" className="btn btn-secondary" disabled={plan.lineups.length >= BWS_LIMITS.lineups} onClick={() => create(false)}><Plus size={15}/>Blank Lineup</button>
      {lineup && <button type="button" className="btn btn-secondary" onClick={() => onPrint(lineup.id)}><Printer size={15}/>Print Lineup Card</button>}
      {lineup && lineup.slots.length > 1 && <button type="button" className="btn btn-secondary" title="Leadoff = best Fall OBP; then by Fall OPS (best OPS bats 2nd). Positions stay the same." onClick={() => setLineup({ ...lineup, slots: suggestedOrder(lineup.slots, orderStats) })}>Suggest Batting Order</button>}
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
      <p className={styles.note}>Suggest Batting Order is optional: leadoff is the best Fall OBP, then the rest by Fall OPS (best OPS bats 2nd), keeping each player&apos;s position. Batters without Fall stats stay at the end. Over {plan.series.inningsPerGame} innings, spots 1–{Math.round(plan.series.inningsPerGame * 4.25) % 9 || 9} project {slotPlateAppearances(0, plan.series.inningsPerGame)} PA and the rest {slotPlateAppearances(8, plan.series.inningsPerGame)}.</p>
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

function Pitching({ plan, update, byId, statsFor, today, onPrint }: Shared & { byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats>; today: string; onPrint: (id: string) => void }) {
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
      <button type="button" className="btn btn-secondary" disabled={!validDate || plan.games.length >= BWS_LIMITS.games} onClick={() => { update({ ...plan, games: [...plan.games, { id: newId(), date, opponent: opponent.trim(), lineupId: plan.lineups[0]?.id ?? null, pitchers: [], batters: [], notes: "" }].sort((a, b) => a.date.localeCompare(b.date)) }); setOpponent(""); }}><Plus size={15}/>Add Game</button>
    </div>
    {!plan.games.length && <p className={styles.note}>Add each BWS game, then plan who pitches and for how many innings. After the game, record actual innings and pitch counts so the usage table stays accurate.</p>}
    <div className={styles.games}>{plan.games.map(game => { const planned = game.pitchers.reduce((sum, p) => sum + p.plannedOuts, 0); return <article key={game.id} className={styles.game} data-past={game.date < today}>
      <header><strong>{shortDate(game.date)}{game.opponent ? ` vs ${game.opponent}` : ""}</strong><span className={styles.muted}>{formatOuts(planned)} IP planned</span>
        <select aria-label="Lineup for this game" value={game.lineupId ?? ""} onChange={e => setGame({ ...game, lineupId: e.target.value || null })}><option value="">No lineup</option>{plan.lineups.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <button type="button" className="btn btn-secondary" onClick={() => onPrint(game.id)}><Printer size={15}/>Game Sheet</button>
        <button type="button" className={styles.iconButton} aria-label="Delete game" onClick={() => update({ ...plan, games: plan.games.filter(g => g.id !== game.id) })}><Trash2 size={15}/></button></header>
      <h4>Pitching</h4>
      <table className={styles.table}><thead><tr><th>Pitcher</th><th className={styles.num}>Planned IP</th><th className={styles.num}>Actual IP</th><th className={styles.num}>Batters Faced</th><th className={styles.num}>Pitches</th><th aria-label="Order"/></tr></thead>
        <tbody>{game.pitchers.map((p, index) => <tr key={p.playerId}>
          <th scope="row">{byId.get(p.playerId)?.name}</th>
          <td className={styles.num}><InningsInput label="Planned innings" value={p.plannedOuts} onChange={v => v !== null && setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, plannedOuts: v } : x) })}/></td>
          <td className={styles.num}><InningsInput label="Actual innings" value={p.actualOuts} allowEmpty onChange={v => setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, actualOuts: v } : x) })}/></td>
          <td className={styles.num}><input className={styles.small} inputMode="numeric" aria-label="Batters faced" value={p.battersFaced ?? ""} onChange={e => { const v = e.target.value.trim(); if (v === "" || /^\d{1,2}$/.test(v) && Number(v) <= 60) setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, battersFaced: v === "" ? null : Number(v) } : x) }); }}/></td>
          <td className={styles.num}><input className={styles.small} inputMode="numeric" aria-label="Pitch count" value={p.pitches ?? ""} onChange={e => { const v = e.target.value.trim(); if (v === "" || /^\d{1,3}$/.test(v) && Number(v) <= 200) setGame({ ...game, pitchers: game.pitchers.map((x, i) => i === index ? { ...x, pitches: v === "" ? null : Number(v) } : x) }); }}/></td>
          <td><span className={styles.rowActions}><button type="button" className={styles.iconButton} aria-label="Earlier" disabled={index === 0} onClick={() => setGame({ ...game, pitchers: move(game.pitchers, index, -1) })}><ArrowUp size={14}/></button><button type="button" className={styles.iconButton} aria-label="Later" disabled={index === game.pitchers.length - 1} onClick={() => setGame({ ...game, pitchers: move(game.pitchers, index, 1) })}><ArrowDown size={14}/></button><button type="button" className={styles.iconButton} aria-label="Remove pitcher" onClick={() => setGame({ ...game, pitchers: game.pitchers.filter((_, i) => i !== index) })}><X size={14}/></button></span></td>
        </tr>)}</tbody></table>
      {game.pitchers.length < BWS_LIMITS.pitchersPerGame && <PlayerSelect label="Add pitcher" players={pitchers} value="" exclude={game.pitchers.map(p => p.playerId)} onChange={id => id && setGame({ ...game, pitchers: [...game.pitchers, { playerId: id, plannedOuts: plan.series.minOuts, actualOuts: null, pitches: null, battersFaced: null }] })}/>}
      <BattingResults game={game} plan={plan} byId={byId} setGame={setGame}/>
      <textarea aria-label="Game notes" placeholder="Game notes" value={game.notes} maxLength={BWS_LIMITS.note} onChange={e => setGame({ ...game, notes: e.target.value })}/>
    </article>; })}</div>
    <p className={styles.note}>Innings use baseball notation (4.2 = 4 innings and 2 outs). BWS IP counts actual innings when recorded, otherwise the plan, for games on or before today. After each game, record innings, batters faced and each batter&apos;s at-bats so the Series tracker uses real results. Rest and pitch-count limits are your call; nothing here sets them.</p>
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

function requirementRates(plan: BwsTeamPlan, statsFor: Map<string, BwsPlayerStats>) {
  return new Map(plan.players.flatMap(p => { const s = p.athleteId ? statsFor.get(p.athleteId) : undefined; if (!s || !p.athleteId) return [];
    return [[p.athleteId, { abRate: s.atBats !== null && s.plateAppearances ? s.atBats / s.plateAppearances : null, whip: s.pitching.find(x => x.key === "pitching_whip")?.raw ?? null }] as const]; }));
}
const STATUS_LABEL: Record<BwsRequirementRow["status"], string> = { met: "Met", "on-track": "On track", "at-risk": "Needs time" };

function Series({ plan, update, statsFor, today, onPrint, openGames }: Shared & { statsFor: Map<string, BwsPlayerStats>; today: string; onPrint: (id: string) => void; openGames: () => void }) {
  const [date, setDate] = useState(today);
  const series = plan.series, setSeries = (next: Partial<typeof series>) => update({ ...plan, series: { ...series, ...next } });
  const rows = seriesRequirements(plan, requirementRates(plan, statsFor));
  const batters = rows.filter(r => r.kind === "batter").sort((a, b) => (a.status === b.status ? a.projected - b.projected : ["at-risk", "on-track", "met"].indexOf(a.status) - ["at-risk", "on-track", "met"].indexOf(b.status)));
  const pitchers = rows.filter(r => r.kind === "pitcher").sort((a, b) => (a.status === b.status ? a.projected - b.projected : ["at-risk", "on-track", "met"].indexOf(a.status) - ["at-risk", "on-track", "met"].indexOf(b.status)));
  const count = (list: BwsRequirementRow[], status: BwsRequirementRow["status"]) => list.filter(r => r.status === status).length;
  const lineupName = (id: string | null) => plan.lineups.find(l => l.id === id)?.name ?? "No lineup";
  const number = (value: number, set: (v: number) => void, label: string, max: number, min = 0) => <label className={styles.setting}><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={e => { const v = Number(e.target.value); if (Number.isSafeInteger(v) && v >= min && v <= max) set(v); }}/></label>;
  return <section className={styles.panel} aria-label="Series planner">
    <h3>Requirements</h3>
    <div className={styles.addRow}>
      {number(series.minAtBats, v => setSeries({ minAtBats: v }), "At-bats per batter", 30)}
      {number(series.minBattersFaced, v => setSeries({ minBattersFaced: v }), "Batters faced per pitcher", 60)}
      <label className={styles.setting}><span>Or innings per pitcher</span><input type="number" min={0} max={20} value={series.minOuts / 3} onChange={e => { const v = Number(e.target.value); if (Number.isSafeInteger(v) && v >= 0 && v <= 20) setSeries({ minOuts: v * 3 }); }}/></label>
      {number(series.inningsPerGame, v => setSeries({ inningsPerGame: v }), "Innings per game", 12, 3)}
    </div>
    <p className={styles.note}>Series totals across every game. A pitcher meets the minimum with {series.minBattersFaced} batters faced <em>or</em> {formatOuts(series.minOuts)} innings.</p>
    <h3>Schedule <small>{plan.games.length} games</small></h3>
    <div className={styles.addRow}>
      <input type="date" aria-label="Game date" value={date} min="2026-08-01" max="2026-12-31" onChange={e => setDate(e.target.value)}/>
      <button type="button" className="btn btn-secondary" disabled={!/^2026-(0[89]|1[0-2])-\d{2}$/.test(date) || plan.games.length >= BWS_LIMITS.games} onClick={() => update({ ...plan, games: [...plan.games, { id: newId(), date, opponent: "", lineupId: plan.lineups[0]?.id ?? null, pitchers: [], batters: [], notes: "" }].sort((a, b) => a.date.localeCompare(b.date)) })}><Plus size={15}/>Add Game</button>
      <button type="button" className="btn btn-secondary" onClick={openGames}>Plan Games</button>
    </div>
    {plan.games.length > 0 && <div className="table-wrap"><table className={styles.table}><thead><tr><th>Game</th><th>Lineup</th><th className={styles.num}>Pitchers</th><th className={styles.num}>Planned IP</th><th>Results</th><th aria-label="Print"/></tr></thead>
      <tbody>{plan.games.map((g, i) => <tr key={g.id}><th scope="row">Game {i + 1} · {shortDate(g.date)}</th><td>{lineupName(g.lineupId)}</td><td className={styles.num}>{g.pitchers.length}</td><td className={styles.num}>{formatOuts(g.pitchers.reduce((n, p) => n + p.plannedOuts, 0))}</td>
        <td>{g.batters.length || g.pitchers.some(p => p.actualOuts !== null || p.battersFaced !== null) ? "Recorded" : g.date < today ? <span className={styles.warnText}>Not recorded</span> : <span className={styles.muted}>Upcoming</span>}</td>
        <td><button type="button" className={styles.iconButton} aria-label={`Print game ${i + 1} sheet`} onClick={() => onPrint(g.id)}><Printer size={14}/></button></td></tr>)}</tbody></table></div>}
    <h3>Batters <small>{count(batters, "met")} met · {count(batters, "on-track")} on track · {count(batters, "at-risk")} need time</small></h3>
    {!batters.length ? <p className={styles.note}>Add position players and two-way players on the Roster tab.</p> :
    <div className="table-wrap"><table className={styles.table}><thead><tr><th>Batter</th><th>Status</th><th className={styles.num}>AB Recorded</th><th className={styles.num}>Projected AB</th><th className={styles.num}>Still Needed</th><th className={styles.num}>Games in Lineup</th></tr></thead>
      <tbody>{batters.map(r => <tr key={r.player.id} data-status={r.status}><th scope="row">{r.player.name}</th><td><span className={styles.chip} data-status={r.status}>{STATUS_LABEL[r.status]}</span></td>
        <td className={styles.num}>{r.actual}</td><td className={styles.num} title={`AB/PA ${r.detail.abRate?.toFixed(2)}${r.detail.estimated ? " (team default)" : " (own Fall rate)"}`}>{r.projected.toFixed(1)}</td><td className={styles.num}>{Math.max(0, r.required - r.actual)}</td><td className={styles.num}>{r.games}</td></tr>)}</tbody></table></div>}
    <h3>Pitchers <small>{count(pitchers, "met")} met · {count(pitchers, "on-track")} on track · {count(pitchers, "at-risk")} need time</small></h3>
    {!pitchers.length ? <p className={styles.note}>Add pitchers and two-way players on the Roster tab.</p> :
    <div className="table-wrap"><table className={styles.table}><thead><tr><th>Pitcher</th><th>Status</th><th className={styles.num}>BF Recorded</th><th className={styles.num}>IP Recorded</th><th className={styles.num}>Projected BF</th><th className={styles.num}>Projected IP</th><th className={styles.num}>Games</th></tr></thead>
      <tbody>{pitchers.map(r => <tr key={r.player.id} data-status={r.status}><th scope="row">{r.player.name}</th><td><span className={styles.chip} data-status={r.status}>{STATUS_LABEL[r.status]}</span></td>
        <td className={styles.num}>{r.detail.actualBattersFaced}</td><td className={styles.num}>{formatOuts(r.detail.actualOuts ?? 0)}</td><td className={styles.num}>{(r.detail.projectedBattersFaced ?? 0).toFixed(1)}</td><td className={styles.num}>{formatOuts(r.detail.projectedOuts ?? 0)}</td><td className={styles.num}>{r.games}</td></tr>)}</tbody></table></div>}
    <p className={styles.note}>Recorded results always count first. For games without results, projected at-bats come from each batter&apos;s lineup spot ({series.inningsPerGame} innings at about 4.25 batters per inning) times their own Fall AB/PA rate (0.88 if unknown), and projected batters faced come from planned innings and the pitcher&apos;s Fall WHIP (1.40 if unknown). Projections are planning estimates, not guarantees.</p>
  </section>;
}

function BattingResults({ game, plan, byId, setGame }: { game: BwsGame; plan: BwsTeamPlan; byId: Map<string, BwsPlayer>; setGame: (game: BwsGame) => void }) {
  const lineup = plan.lineups.find(l => l.id === game.lineupId);
  const start = () => setGame({ ...game, batters: (lineup?.slots ?? []).map(s => ({ playerId: s.playerId, atBats: 0, plateAppearances: null })) });
  const set = (index: number, key: "atBats" | "plateAppearances", raw: string) => {
    const v = raw.trim(); if (v !== "" && !/^\d{1,2}$/.test(v)) return;
    const value = v === "" ? null : Math.min(12, Number(v));
    if (key === "atBats" && value === null) return;
    setGame({ ...game, batters: game.batters.map((b, i) => i !== index ? b : key === "atBats" ? { ...b, atBats: value!, plateAppearances: b.plateAppearances !== null && b.plateAppearances < value! ? value : b.plateAppearances } : { ...b, plateAppearances: value !== null && value < b.atBats ? b.atBats : value }) });
  };
  const batters = plan.players.filter(p => p.role !== "pitcher");
  return <div className={styles.results}><h4>Batting Results</h4>
    {!game.batters.length ? <p className={styles.note}>After the game, record each batter&apos;s at-bats.{" "}{lineup ? <button type="button" className="btn btn-secondary" onClick={start}>Start from {lineup.name}</button> : "Choose a lineup or add batters below."}</p> :
    <table className={styles.table}><thead><tr><th>Batter</th><th className={styles.num}>AB</th><th className={styles.num}>PA (optional)</th><th aria-label="Remove"/></tr></thead>
      <tbody>{game.batters.map((b, index) => <tr key={b.playerId}><th scope="row">{byId.get(b.playerId)?.name}</th>
        <td className={styles.num}><input className={styles.small} inputMode="numeric" aria-label="At-bats" value={b.atBats} onChange={e => set(index, "atBats", e.target.value)}/></td>
        <td className={styles.num}><input className={styles.small} inputMode="numeric" aria-label="Plate appearances" value={b.plateAppearances ?? ""} onChange={e => set(index, "plateAppearances", e.target.value)}/></td>
        <td><button type="button" className={styles.iconButton} aria-label="Remove batter" onClick={() => setGame({ ...game, batters: game.batters.filter((_, i) => i !== index) })}><X size={14}/></button></td></tr>)}</tbody></table>}
    <PlayerSelect label="Add batter or sub" players={batters} value="" exclude={game.batters.map(b => b.playerId)} onChange={id => id && setGame({ ...game, batters: [...game.batters, { playerId: id, atBats: 0, plateAppearances: null }] })}/>
  </div>;
}

const SCOUT_HIT = ["batting_production_plus", "batting_ops", "batting_obp", "batting_avg", "batting_k_pct", "batting_bb_pct", "batting_est_iso", "sb"], SCOUT_HIT_LABELS = ["PAC Prod+", "OPS", "OBP", "AVG", "K%", "BB%", "ISO", "SB"];
const SCOUT_PITCH = ["pitching_whip", "pitching_k_bb", "pitching_r9", "strike_pct", "pitching_k9"], SCOUT_PITCH_LABELS = ["WHIP", "K/BB", "Runs/9", "Strike %", "K/9"];
function Scouting({ plan, update, athletes, statsFor }: Shared & { athletes: { id: string; name: string }[]; statsFor: Map<string, BwsPlayerStats> }) {
  const [choice, setChoice] = useState("");
  const taken = new Set([...plan.players.flatMap(p => p.athleteId ? [p.athleteId] : []), ...plan.series.opponents.map(o => o.athleteId)]);
  const options = athletes.filter(a => !taken.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  const name = (id: string) => athletes.find(a => a.id === id)?.name ?? statsFor.get(id)?.name ?? "Unknown player";
  const setOpponents = (opponents: typeof plan.series.opponents) => update({ ...plan, series: { ...plan.series, opponents } });
  const roleFor = (id: string): BwsRole => { const s = statsFor.get(id), t = s?.playerType.trim().toLowerCase(); return t === "two_way" ? "two_way" : t === "pitcher" || [s?.position, s?.secondaryPosition].some(p => p?.trim().toUpperCase() === "P") ? "pitcher" : "position"; };
  const hitters = plan.series.opponents.filter(o => o.role !== "pitcher"), arms = plan.series.opponents.filter(o => o.role !== "position");
  const hand = (id: string, key: "bats" | "throws") => statsFor.get(id)?.[key] || "—";
  return <section className={styles.panel} aria-label="Opponent scouting">
    <div className={styles.addRow}>
      <select aria-label="Add an opposing player" value={choice} disabled={plan.series.opponents.length >= BWS_LIMITS.opponents} onChange={e => setChoice(e.target.value)}><option value="">Add an opposing player…</option>{options.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <button type="button" className="btn btn-secondary" disabled={!choice} onClick={() => { setOpponents([...plan.series.opponents, { athleteId: choice, role: roleFor(choice) }]); setChoice(""); }}><Plus size={15}/>Add</button>
    </div>
    {!plan.series.opponents.length && <p className={styles.note}>Add the other team&apos;s players to build a scouting sheet from their Fall game stats. Your own players can&apos;t be added here.</p>}
    {hitters.length > 0 && <><h3>Their Hitters <small>{hitters.length}</small></h3><div className="table-wrap"><table className={styles.table}><thead><tr><th>Hitter</th><th>Bats</th>{SCOUT_HIT_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}<th aria-label="Remove"/></tr></thead>
      <tbody>{[...hitters].sort((a, b) => (statsFor.get(b.athleteId)?.hitting.find(x => x.key === "batting_ops")?.raw ?? -1) - (statsFor.get(a.athleteId)?.hitting.find(x => x.key === "batting_ops")?.raw ?? -1)).map(o => <tr key={o.athleteId}><th scope="row"><Link prefetch={false} href={`/athletes/${o.athleteId}`}>{name(o.athleteId)}</Link></th><td>{hand(o.athleteId, "bats")}</td><StatCells stats={statsFor.get(o.athleteId)?.hitting} keys={SCOUT_HIT}/>
        <td><button type="button" className={styles.iconButton} aria-label="Remove" onClick={() => setOpponents(plan.series.opponents.filter(x => x.athleteId !== o.athleteId))}><X size={14}/></button></td></tr>)}</tbody></table></div></>}
    {arms.length > 0 && <><h3>Their Pitchers <small>{arms.length}</small></h3><div className="table-wrap"><table className={styles.table}><thead><tr><th>Pitcher</th><th>Throws</th>{SCOUT_PITCH_LABELS.map(l => <th key={l} className={styles.num}>{l}</th>)}<th aria-label="Remove"/></tr></thead>
      <tbody>{arms.map(o => <tr key={o.athleteId}><th scope="row"><Link prefetch={false} href={`/athletes/${o.athleteId}?tab=pitching`}>{name(o.athleteId)}</Link></th><td>{hand(o.athleteId, "throws")}</td><StatCells stats={statsFor.get(o.athleteId)?.pitching} keys={SCOUT_PITCH}/>
        <td><button type="button" className={styles.iconButton} aria-label="Remove" onClick={() => setOpponents(plan.series.opponents.filter(x => x.athleteId !== o.athleteId))}><X size={14}/></button></td></tr>)}</tbody></table></div></>}
    <p className={styles.note}>Cumulative Fall game-sheet stats; hover a value for its sample. Hitters are listed by OPS. Open a name for the full profile, including pitch arsenal and contact quality.</p>
  </section>;
}

/** Print-only game-day sheet: lineup, bench, pitching plan and what each player still needs for the series minimums. */
function GameSheet({ game, plan, byId, statsFor }: { game: BwsGame; plan: BwsTeamPlan; byId: Map<string, BwsPlayer>; statsFor: Map<string, BwsPlayerStats> }) {
  const lineup = plan.lineups.find(l => l.id === game.lineupId);
  const number = plan.games.findIndex(g => g.id === game.id) + 1;
  const needs = new Map(seriesRequirements(plan, requirementRates(plan, statsFor)).map(r => [`${r.kind}:${r.player.id}`, r]));
  const inLineup = new Set(lineup?.slots.map(s => s.playerId) ?? []);
  const remaining = (kind: "batter" | "pitcher", id: string) => { const r = needs.get(`${kind}:${id}`); if (!r) return ""; if (r.status === "met") return "Met"; return kind === "batter" ? `Needs ${Math.max(0, r.required - r.actual)} AB` : `Needs ${Math.max(0, plan.series.minBattersFaced - (r.detail.actualBattersFaced ?? 0))} BF or ${formatOuts(Math.max(0, plan.series.minOuts - (r.detail.actualOuts ?? 0)))} IP`; };
  return <div className={styles.printCard} aria-hidden="true">
    <h2>{plan.name} · Game {number}</h2><p>{shortDate(game.date)}{game.opponent ? ` vs ${game.opponent}` : ""}{lineup ? ` · ${lineup.name}` : ""}</p>
    {lineup && <table><thead><tr><th>#</th><th>Batter</th><th>Pos</th><th>Series</th></tr></thead><tbody>{lineup.slots.map((s, i) => <tr key={s.playerId}><td>{i + 1}</td><td>{byId.get(s.playerId)?.name}</td><td>{s.position}</td><td>{remaining("batter", s.playerId)}</td></tr>)}</tbody></table>}
    <div className={styles.printColumns}>
      <div><h3>Bench</h3><ul>{plan.players.filter(p => p.role !== "pitcher" && !inLineup.has(p.id)).map(p => <li key={p.id}>{p.name} · {remaining("batter", p.id)}</li>)}</ul></div>
      <div><h3>Pitching Plan</h3><ol>{game.pitchers.map(p => <li key={p.playerId}>{byId.get(p.playerId)?.name} · {formatOuts(p.plannedOuts)} IP · {remaining("pitcher", p.playerId)}</li>)}</ol></div>
    </div>
    {game.notes && <p>{game.notes}</p>}
  </div>;
}
