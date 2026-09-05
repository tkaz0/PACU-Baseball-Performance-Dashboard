import type { RosterAthlete } from "@/lib/types";

export const ATHLETE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
export const MAX_ATHLETE_CODE_ALIASES = 100;
const MAX_PAC_NUMBER = 999999999;

/** The approved change preserves the number; it never orders athletes by name. */
export function pacCodeForLegacy(code: string): string | null {
  const match = /^LOCAL-([0-9]{4,9})$/.exec(code);
  if (!match || Number(match[1]) < 1 || String(Number(match[1])).padStart(4, "0") !== match[1]) return null;
  return `PAC-${match[1]}`;
}

export function athleteCodeIndex(roster: RosterAthlete[]): Map<string, RosterAthlete> {
  const index = new Map<string, RosterAthlete>();
  for (const athlete of roster) {
    const codes = [athlete.athlete_code, ...(athlete.athlete_code_aliases ?? [])];
    if ((athlete.athlete_code_aliases?.length ?? 0) > MAX_ATHLETE_CODE_ALIASES) throw new Error("Too many previous athlete IDs.");
    for (const code of codes) {
      if (!ATHLETE_CODE_PATTERN.test(code) || index.has(code)) throw new Error("Athlete IDs or previous IDs conflict. Resolve the roster before importing.");
      index.set(code, athlete);
    }
  }
  return index;
}

/** Exact recorded aliases only. This never matches a name, email, or numeric suffix. */
export function resolveAthleteCode(roster: RosterAthlete[], code: string): string | null {
  return athleteCodeIndex(roster).get(code.trim().toUpperCase())?.athlete_code ?? null;
}

/** Allocates within the reviewed master roster; independent workspaces are not coordinated. */
export function nextPacCode(reserved: Iterable<string>): string {
  const used = new Set(reserved);
  let next = 1;
  for (const code of used) {
    const match = /^(?:PAC|LOCAL)-([0-9]{4,9})$/.exec(code);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  if (next > MAX_PAC_NUMBER) throw new Error("The PAC athlete ID sequence is full.");
  return `PAC-${String(next).padStart(4, "0")}`;
}
