import { normalizeRenphoId, RENPHO_ID_PATTERN } from "@/lib/imports/engine";

export type RenphoMapping = { athlete_code: string; renpho_id: string };
export function parseRenphoMappingFile(text: string, athleteCodes: readonly string[]): RenphoMapping[] {
  if (new TextEncoder().encode(text).byteLength > 65536) throw new Error("Choose a roster ID file up to 64 KiB.");
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || !("mappings" in input) ||
    !Array.isArray(input.mappings) || input.mappings.length < 1 || input.mappings.length > 200) throw new Error("Choose a prepared roster ID file with 1–200 mappings.");
  const known = new Set(athleteCodes), ids = new Set<string>();
  return input.mappings.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== 2 ||
      typeof row.athlete_code !== "string" || !known.has(row.athlete_code) || typeof row.renpho_id !== "string") throw new Error("Every ID must match an existing player’s PAC ID.");
    const id = normalizeRenphoId(row.renpho_id);
    if (!RENPHO_ID_PATTERN.test(id) || ids.has(id)) throw new Error("Check blank, invalid, or duplicate RENPHO IDs before uploading.");
    ids.add(id);
    return { athlete_code: row.athlete_code, renpho_id: id };
  });
}
