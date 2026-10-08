import { UUID_PATTERN } from "@/lib/types";

export const DRAFT_GROUPS = ["Pitchers", "Two-Ways", "Outfielders", "First Base", "Infielders", "Catchers", "Injured / Student Assistants"] as const;
export type DraftGroup = typeof DRAFT_GROUPS[number];
export type DraftPlayer = { id: string; name: string; group: DraftGroup; positions: string; athleteId: string | null };
export type DraftTeam = { name: string; captains: string[] };
export type DraftDocument = { version: 1; title: string; teams: [DraftTeam, DraftTeam]; players: DraftPlayer[]; picks: string[] };
export type DraftSnapshot = { revision: number; document: DraftDocument; updatedAt: string; lastRequestId: string };
export type DraftSaveRequest = { requestId: string; expectedRevision: number; document: DraftDocument };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => key in v);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && v === v.trim() && (empty || v.length > 0) && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const unique = (values: string[]) => new Set(values.map(v => v.toLowerCase())).size === values.length;
export const draftable = (player: DraftPlayer) => player.group !== "Injured / Student Assistants";

/** The sheet uses Team 1, Team 2, Team 2, Team 1, repeating. */
export function draftTeamForPick(pick: number): 0 | 1 {
  if (!Number.isSafeInteger(pick) || pick < 1 || pick > 100) throw new Error("Invalid pick number.");
  return (pick - 1) % 4 === 0 || (pick - 1) % 4 === 3 ? 0 : 1;
}
export function validateDraftDocument(value: unknown): DraftDocument {
  const fail = (): never => { throw new Error("Check the draft title, two teams, player names, groups and picks."); };
  if (!object(value) || !exact(value, ["version", "title", "teams", "players", "picks"]) || value.version !== 1 || !text(value.title, 100) ||
    !Array.isArray(value.teams) || value.teams.length !== 2 || !Array.isArray(value.players) || value.players.length > 100 || !Array.isArray(value.picks) || value.picks.length > 100) return fail();
  const teams: DraftTeam[] = [];
  for (const team of value.teams) {
    if (!object(team) || !exact(team, ["name", "captains"]) || !text(team.name, 40) || !Array.isArray(team.captains) || team.captains.length > 4 || team.captains.some(name => !text(name, 80))) return fail();
    teams.push(team as DraftTeam);
  }
  if (!unique(teams.map(t => t.name)) || !unique(teams.flatMap(t => t.captains))) return fail();
  const players: DraftPlayer[] = [];
  for (const player of value.players) {
    if (!object(player) || !exact(player, ["id", "name", "group", "positions", "athleteId"]) || typeof player.id !== "string" || !UUID_PATTERN.test(player.id) ||
      !text(player.name, 80) || !DRAFT_GROUPS.includes(player.group as DraftGroup) || !text(player.positions, 40, true) || (player.athleteId !== null && (typeof player.athleteId !== "string" || !UUID_PATTERN.test(player.athleteId)))) return fail();
    players.push(player as DraftPlayer);
  }
  if (!unique(players.map(p => p.id)) || !unique(players.map(p => p.name)) || !unique(players.flatMap(p => p.athleteId ? [p.athleteId] : [])) ||
    players.some(p => teams.some(t => t.captains.some(name => name.toLowerCase() === p.name.toLowerCase())))) return fail();
  const pool = new Set(players.filter(draftable).map(p => p.id));
  if (value.picks.some(id => typeof id !== "string" || !pool.has(id)) || !unique(value.picks as string[])) return fail();
  return { version: 1, title: value.title, teams: teams as [DraftTeam, DraftTeam], players, picks: value.picks as string[] };
}
export function validateDraftSnapshot(value: unknown): DraftSnapshot {
  if (!object(value) || !exact(value, ["revision", "document", "updatedAt", "lastRequestId"]) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
    typeof value.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.lastRequestId !== "string" || !UUID_PATTERN.test(value.lastRequestId)) throw new Error("The saved draft could not be verified. Refresh to try again.");
  return { revision: Number(value.revision), document: validateDraftDocument(value.document), updatedAt: value.updatedAt, lastRequestId: value.lastRequestId };
}
export function emptyDraft(): DraftDocument {
  return { version: 1, title: "Boxer World Series", teams: [{ name: "Team 1", captains: [] }, { name: "Team 2", captains: [] }], players: [], picks: [] };
}
export function draftView(document: DraftDocument) {
  const byId = new Map(document.players.map(p => [p.id, p]));
  const selections = document.picks.map((id, index) => ({ player: byId.get(id)!, pick: index + 1, team: draftTeamForPick(index + 1) }));
  const taken = new Set(document.picks), pool = document.players.filter(draftable), available = pool.filter(p => !taken.has(p.id));
  return { selections, pool, available, complete: pool.length > 0 && !available.length, nextPick: document.picks.length + 1,
    nextTeam: document.picks.length < 100 ? draftTeamForPick(document.picks.length + 1) : null,
    rosters: ([0, 1] as const).map(team => selections.filter(p => p.team === team)),
    rounds: Array.from({ length: Math.ceil(pool.length / 2) }, (_, index) => ([0, 1] as const).map(team => {
      const first = index * 2 + 1, pick = draftTeamForPick(first) === team ? first : first + 1;
      return pick <= pool.length ? { pick, player: selections[pick - 1]?.player ?? null } : null;
    })) };
}
/** Editable group text never creates roster identities or accounts. */
export function draftPlayersFromGroups(groups: Record<DraftGroup, string>, previous: DraftPlayer[], newId: () => string): DraftPlayer[] {
  return DRAFT_GROUPS.flatMap(group => groups[group].split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split("|");
    if (parts.length > 2) throw new Error("Use one player per line: Name | Positions.");
    const name = parts[0].trim(), prior = previous.find(p => p.name.toLowerCase() === name.toLowerCase());
    return { id: prior?.id ?? newId(), name, group, positions: parts[1]?.trim() ?? "", athleteId: prior?.athleteId ?? null };
  }));
}
export function draftExportRows(document: DraftDocument): string[][] {
  const view = draftView(document);
  return [["Team", "Pick", "Player", "Group", "Positions"], ...document.teams.flatMap(team => team.captains.map(name => [team.name, "Captain", name, "Captain", ""])),
    ...view.selections.map(row => [document.teams[row.team].name, String(row.pick), row.player.name, row.player.group, row.player.positions]),
    ...view.available.map(p => ["Available", "", p.name, p.group, p.positions]),
    ...document.players.filter(p => !draftable(p)).map(p => ["Not in Draft Pool", "", p.name, p.group, p.positions])];
}
