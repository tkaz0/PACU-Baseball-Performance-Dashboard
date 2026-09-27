import { parseBlastSource } from "@/lib/blast-metrics";
import { fullSwingFileLabel } from "@/lib/full-swing-file-label";
import { classifiedPitchSource } from "@/lib/imports/classified-pitch-results";

export type SessionReadingMetadata = { observationId: string; athleteId: string; fileHash: string; sourceFile: string; source: string; metricKey: string; date: string; savedAt: string };
export type SessionContactMetadata = { athleteId: string; fileHash: string; sourceFile: string; sourceRow: number; category: "game" | "intrasquad" | "practice"; date: string; savedAt: string };
export type SessionLibraryPlayer = { id: string; code: string; name: string };
export type SessionPublication = {
  fileHash: string; fileName: string; date: string; category: "game" | "intrasquad" | "practice";
  mode: string; eventCount: number; revision: number; measurementCount: number; sampleCount: number;
  contactCount: number; assignedCount: number; unresolvedPitchCount: number; excludedPlayerCount: number;
  removedValueCount: number; publishedAt: string; lastUpdatedAt: string; fullyPublished: boolean; restoreTargetRevision: number | null;
};
export type LibrarySession = {
  id: string; fileHash: string; originalFiles: string[]; label: string; vendor: "Full Swing" | "Blast";
  context: "in_game" | "practice"; category: string; reportKind: "average" | "p95" | null;
  date: string; startDate: string | null; savedAt: string; measurementCount: number; contactCount: number;
  players: (SessionLibraryPlayer & { hitting: boolean; pitching: boolean; contactMap: boolean })[];
  hitterCount: number; pitcherCount: number; classifiedPitcherCount: number; pitchTypes: string[];
  publication: SessionPublication | null;
};

const hitting = new Set(["max_exit_velocity", "avg_exit_velocity", "bat_speed", "max_bat_speed", "avg_bat_speed", "smash_factor", "max_distance"]);
const pitching = new Set(["max_pitch_velocity", "avg_pitch_velocity", "avg_fastball_spin", "strike_pct", "k_pct", "bb_pct"]);
const keyFor = (hash: string, category: string, date: string) => JSON.stringify([hash, category, date]);
function sourceDetails(source: string, date: string) {
  const blast = parseBlastSource(source);
  if (blast && blast.end === date) return { vendor: "Blast" as const, category: source, context: "practice" as const, reportKind: blast.kind, startDate: blast.start };
  if (source === "Blast Motion · Hitting") return { vendor: "Blast" as const, category: source, context: "practice" as const, reportKind: null, startDate: null };
  const fullSwing = /^Full Swing · (Game|Intrasquad|Practice|Hitting|Pitching)(?: · .+)?$/.exec(source);
  if (!fullSwing) return null;
  return { vendor: "Full Swing" as const, category: fullSwing[1].toLowerCase(), context: fullSwing[1] === "Game" || fullSwing[1] === "Intrasquad" ? "in_game" as const : "practice" as const, reportKind: null, startDate: null };
}

/** An existing measurement proves only that result was saved, never that the entire original CSV was reviewed. */
export function buildSessionLibrary(readings: readonly SessionReadingMetadata[], contacts: readonly SessionContactMetadata[], players: readonly SessionLibraryPlayer[], publications: readonly SessionPublication[] = []): LibrarySession[] {
  const people = new Map(players.map(player => [player.id, player]));
  const groups = new Map<string, LibrarySession>();
  const classifiedPlayers = new Map<string, Set<string>>();
  const ensure = (hash: string, sourceFile: string, source: string, date: string, savedAt: string) => {
    const details = sourceDetails(source, date);
    if (!details) return null;
    const id = keyFor(hash, details.category, date);
    const item = groups.get(id) ?? { id, fileHash: hash, ...details, originalFiles: [], label: "", date, savedAt,
      measurementCount: 0, contactCount: 0, players: [], hitterCount: 0, pitcherCount: 0, classifiedPitcherCount: 0, pitchTypes: [], publication: null };
    if (!item.originalFiles.includes(sourceFile)) item.originalFiles.push(sourceFile);
    if (savedAt > item.savedAt) item.savedAt = savedAt;
    groups.set(id, item);
    return item;
  };
  const playerFor = (item: LibrarySession, id: string) => {
    const person = people.get(id);
    if (!person) throw new Error("The saved session's player matches could not be verified.");
    let player = item.players.find(player => player.id === id);
    if (!player) { player = { ...person, hitting: false, pitching: false, contactMap: false }; item.players.push(player); }
    return player;
  };
  const seen = new Set<string>();
  for (const row of readings) {
    if (seen.has(row.observationId)) throw new Error("The session list changed while loading. Refresh to try again.");
    seen.add(row.observationId);
    const item = ensure(row.fileHash, row.sourceFile, row.source, row.date, row.savedAt);
    if (!item) continue;
    item.measurementCount++;
    const person = playerFor(item, row.athleteId), classified = classifiedPitchSource(row.source);
    person.hitting ||= item.vendor === "Blast" || hitting.has(row.metricKey);
    person.pitching ||= pitching.has(row.metricKey) || row.metricKey.startsWith("classified_");
    if (classified && /^classified_(avg|max)_(velocity|spin)$/.test(row.metricKey)) {
      if (!item.pitchTypes.includes(classified.pitchType)) item.pitchTypes.push(classified.pitchType);
      const ids = classifiedPlayers.get(item.id) ?? new Set<string>(); ids.add(row.athleteId); classifiedPlayers.set(item.id, ids);
    }
  }
  const contactKeys = new Set<string>();
  for (const row of contacts) {
    const contactKey = JSON.stringify([row.fileHash, row.sourceRow]);
    if (contactKeys.has(contactKey)) throw new Error("The session list changed while loading. Refresh to try again.");
    contactKeys.add(contactKey);
    const source = `Full Swing · ${row.category[0].toUpperCase()}${row.category.slice(1)}`;
    const item = ensure(row.fileHash, row.sourceFile, source, row.date, row.savedAt)!;
    item.contactCount++;
    playerFor(item, row.athleteId).contactMap = true;
  }
  for (const publication of publications) {
    const source = `Full Swing · ${publication.category[0].toUpperCase()}${publication.category.slice(1)}`;
    const item = ensure(publication.fileHash, publication.fileName, source, publication.date, publication.lastUpdatedAt)!;
    if (!item.publication || publication.lastUpdatedAt > item.publication.lastUpdatedAt) item.publication = publication;
  }
  return [...groups.values()].map(item => {
    item.originalFiles.sort();
    item.label = item.vendor === "Blast" ? `Blast · ${item.reportKind === "p95" ? "Weekly Peak (95th)" : item.reportKind === "average" ? "Weekly Average" : "Hitting Summary"}` : fullSwingFileLabel(item.originalFiles[0], `Full Swing · ${item.category[0].toUpperCase()}${item.category.slice(1)}`, item.date);
    item.players.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    item.hitterCount = item.players.filter(player => player.hitting).length;
    item.pitcherCount = item.players.filter(player => player.pitching).length;
    item.classifiedPitcherCount = classifiedPlayers.get(item.id)?.size ?? 0;
    item.pitchTypes.sort();
    return item;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id));
}
