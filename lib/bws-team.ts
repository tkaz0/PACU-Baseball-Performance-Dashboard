import { UUID_PATTERN } from "@/lib/types";

/** Private Boxer World Series team plan. Owner-entered planning only; never roster identities or results. */
export const BWS_POSITIONS = ["C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH"] as const;
export type BwsPosition = typeof BWS_POSITIONS[number];
export const BWS_FIELD_POSITIONS = BWS_POSITIONS.filter(p => p !== "DH");
export type BwsRole = "pitcher" | "position" | "two_way";
export type BwsPlayer = { id: string; name: string; athleteId: string | null; role: BwsRole };
export type BwsLineupSlot = { playerId: string; position: BwsPosition };
export type BwsLineup = { id: string; name: string; slots: BwsLineupSlot[] };
/** Innings are stored as outs (3 per inning) so .1/.2 notation never rounds. */
export type BwsGamePitcher = { playerId: string; plannedOuts: number; actualOuts: number | null; pitches: number | null };
export type BwsGame = { id: string; date: string; opponent: string; lineupId: string | null; pitchers: BwsGamePitcher[]; notes: string };
export type BwsNote = { playerId: string; text: string };
export type BwsTeamPlan = { version: 1; name: string; players: BwsPlayer[]; depth: Record<BwsPosition, string[]>; lineups: BwsLineup[]; games: BwsGame[]; notes: BwsNote[] };
export type BwsSnapshot = { revision: number; document: BwsTeamPlan; updatedAt: string; lastRequestId: string };
export type BwsSaveRequest = { requestId: string; expectedRevision: number; document: BwsTeamPlan };

export const BWS_LIMITS = { players: 40, depthPerPosition: 5, lineups: 12, games: 40, pitchersPerGame: 15, note: 500, notes: 40 } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && v === v.trim() && (empty || v.length > 0) && v.length <= max && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v);
const uuid = (v: unknown): v is string => typeof v === "string" && UUID_PATTERN.test(v);
const unique = (values: string[]) => new Set(values.map(v => v.toLowerCase())).size === values.length;
const outs = (v: unknown, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
const isDate = (v: unknown): v is string => typeof v === "string" && /^2026-(0[89]|1[0-2])-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export function emptyBwsPlan(name = "Boxer World Series"): BwsTeamPlan {
  return { version: 1, name, players: [], depth: Object.fromEntries(BWS_POSITIONS.map(p => [p, []])) as unknown as Record<BwsPosition, string[]>, lineups: [], games: [], notes: [] };
}

export function validateBwsPlan(value: unknown): BwsTeamPlan {
  const fail = (): never => { throw new Error("Check the team name, players, depth chart, lineups and games."); };
  if (!object(value) || !exact(value, ["version", "name", "players", "depth", "lineups", "games", "notes"]) || value.version !== 1 || !text(value.name, 60)) return fail();
  if (!Array.isArray(value.players) || value.players.length > BWS_LIMITS.players) return fail();
  const players: BwsPlayer[] = [];
  for (const p of value.players) {
    if (!object(p) || !exact(p, ["id", "name", "athleteId", "role"]) || !uuid(p.id) || !text(p.name, 80) || (p.athleteId !== null && !uuid(p.athleteId)) || !["pitcher", "position", "two_way"].includes(p.role as string)) return fail();
    players.push({ id: p.id, name: p.name, athleteId: p.athleteId as string | null, role: p.role as BwsRole });
  }
  if (!unique(players.map(p => p.id)) || !unique(players.map(p => p.name)) || !unique(players.flatMap(p => p.athleteId ? [p.athleteId] : []))) return fail();
  const ids = new Set(players.map(p => p.id)), pitchers = new Set(players.filter(p => p.role !== "position").map(p => p.id));
  if (!object(value.depth) || !exact(value.depth, [...BWS_POSITIONS])) return fail();
  const depth = {} as Record<BwsPosition, string[]>;
  for (const position of BWS_POSITIONS) {
    const list = value.depth[position];
    if (!Array.isArray(list) || list.length > BWS_LIMITS.depthPerPosition || list.some(id => typeof id !== "string" || !ids.has(id)) || !unique(list as string[])) return fail();
    depth[position] = list as string[];
  }
  if (!Array.isArray(value.lineups) || value.lineups.length > BWS_LIMITS.lineups) return fail();
  const lineups: BwsLineup[] = [];
  for (const l of value.lineups) {
    if (!object(l) || !exact(l, ["id", "name", "slots"]) || !uuid(l.id) || !text(l.name, 40) || !Array.isArray(l.slots) || l.slots.length > 10) return fail();
    const slots = l.slots.map(s => object(s) && exact(s, ["playerId", "position"]) && typeof s.playerId === "string" && ids.has(s.playerId) && BWS_POSITIONS.includes(s.position as BwsPosition) ? { playerId: s.playerId, position: s.position as BwsPosition } : fail());
    if (!unique(slots.map(s => s.playerId)) || !unique(slots.map(s => s.position))) return fail();
    lineups.push({ id: l.id, name: l.name, slots });
  }
  if (!unique(lineups.map(l => l.id)) || !unique(lineups.map(l => l.name))) return fail();
  if (!Array.isArray(value.games) || value.games.length > BWS_LIMITS.games) return fail();
  const games: BwsGame[] = [];
  for (const g of value.games) {
    if (!object(g) || !exact(g, ["id", "date", "opponent", "lineupId", "pitchers", "notes"]) || !uuid(g.id) || !isDate(g.date) || !text(g.opponent, 60, true) || !text(g.notes, BWS_LIMITS.note, true)
      || (g.lineupId !== null && !lineups.some(l => l.id === g.lineupId)) || !Array.isArray(g.pitchers) || g.pitchers.length > BWS_LIMITS.pitchersPerGame) return fail();
    const used = g.pitchers.map(p => object(p) && exact(p, ["playerId", "plannedOuts", "actualOuts", "pitches"]) && typeof p.playerId === "string" && pitchers.has(p.playerId) && outs(p.plannedOuts, 27)
      && (p.actualOuts === null || outs(p.actualOuts, 27)) && (p.pitches === null || outs(p.pitches, 200)) ? { playerId: p.playerId, plannedOuts: p.plannedOuts as number, actualOuts: p.actualOuts as number | null, pitches: p.pitches as number | null } : fail());
    if (!unique(used.map(p => p.playerId))) return fail();
    games.push({ id: g.id, date: g.date, opponent: g.opponent, lineupId: g.lineupId as string | null, pitchers: used, notes: g.notes });
  }
  if (!unique(games.map(g => g.id))) return fail();
  if (!Array.isArray(value.notes) || value.notes.length > BWS_LIMITS.notes) return fail();
  const notes = value.notes.map(n => object(n) && exact(n, ["playerId", "text"]) && typeof n.playerId === "string" && ids.has(n.playerId) && text(n.text, BWS_LIMITS.note) ? { playerId: n.playerId, text: n.text } : fail());
  if (!unique(notes.map(n => n.playerId))) return fail();
  return { version: 1, name: value.name, players, depth, lineups, games: games.sort((a, b) => a.date.localeCompare(b.date)), notes };
}

export function validateBwsSnapshot(value: unknown): BwsSnapshot {
  if (!object(value) || !exact(value, ["revision", "document", "updatedAt", "lastRequestId"]) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)) || !uuid(value.lastRequestId)) throw new Error("The saved team plan could not be verified. Refresh to try again.");
  return { revision: Number(value.revision), document: validateBwsPlan(value.document), updatedAt: value.updatedAt, lastRequestId: value.lastRequestId };
}

/** Removing a player also removes them from the depth chart, lineups, game plans and notes. */
export function withoutPlayer(plan: BwsTeamPlan, playerId: string): BwsTeamPlan {
  return { ...plan, players: plan.players.filter(p => p.id !== playerId),
    depth: Object.fromEntries(BWS_POSITIONS.map(p => [p, plan.depth[p].filter(id => id !== playerId)])) as Record<BwsPosition, string[]>,
    lineups: plan.lineups.map(l => ({ ...l, slots: l.slots.filter(s => s.playerId !== playerId) })),
    games: plan.games.map(g => ({ ...g, pitchers: g.pitchers.filter(p => p.playerId !== playerId) })),
    notes: plan.notes.filter(n => n.playerId !== playerId) };
}

export const formatOuts = (value: number) => `${Math.floor(value / 3)}${value % 3 ? `.${value % 3}` : ""}`;
/** Baseball notation: "4.2" means 4 innings and 2 outs. Only .0/.1/.2 are accepted. */
export function parseInnings(value: string): number | null {
  const match = /^(\d{1,2})(?:\.([012]))?$/.exec(value.trim());
  if (!match) return null;
  const total = Number(match[1]) * 3 + Number(match[2] ?? 0);
  return total <= 27 ? total : null;
}

export type LineupIssue = { kind: "missing-position" | "no-dh" | "short"; detail: string };
/** Field positions still open in a lineup; a 9-slot lineup without DH is valid. */
export function lineupIssues(lineup: BwsLineup): LineupIssue[] {
  const used = new Set(lineup.slots.map(s => s.position));
  const missing = BWS_FIELD_POSITIONS.filter(p => !used.has(p));
  return [
    ...(lineup.slots.length < 9 ? [{ kind: "short" as const, detail: `${lineup.slots.length} of 9 batters` }] : []),
    ...missing.map(p => ({ kind: "missing-position" as const, detail: `No ${p}` })),
  ];
}

/** Each pitcher's usage across planned/played games: the most recent outing and total outs (actual when recorded, else planned). */
export function pitcherUsage(plan: BwsTeamPlan, today: string) {
  return plan.players.filter(p => p.role !== "position").map(player => {
    const outings = plan.games.flatMap(g => g.pitchers.filter(p => p.playerId === player.id).map(p => ({ date: g.date, opponent: g.opponent, planned: p.plannedOuts, actual: p.actualOuts, pitches: p.pitches })));
    const played = outings.filter(o => o.date <= today), upcoming = outings.filter(o => o.date > today);
    const last = played.at(-1) ?? null;
    return { player, outings, appearances: played.length, totalOuts: played.reduce((sum, o) => sum + (o.actual ?? o.planned), 0),
      plannedUpcoming: upcoming.reduce((sum, o) => sum + o.planned, 0), last, daysSinceLast: last ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000 : null };
  });
}

/** Trim free text before saving so stray spaces never fail validation; empty notes are dropped. */
export function normalizeBwsPlan(plan: BwsTeamPlan): BwsTeamPlan {
  return { ...plan, name: plan.name.trim(), players: plan.players.map(p => ({ ...p, name: p.name.trim() })),
    lineups: plan.lineups.map(l => ({ ...l, name: l.name.trim() || "Lineup" })),
    games: plan.games.map(g => ({ ...g, opponent: g.opponent.trim(), notes: g.notes.trim() })).sort((a, b) => a.date.localeCompare(b.date)),
    notes: plan.notes.map(n => ({ ...n, text: n.text.trim() })).filter(n => n.text) };
}
