import "server-only";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { requireAccess, requireImportAccess } from "@/lib/auth";
import type { ReviewedContact } from "@/lib/imports/full-swing-contacts";
import { UUID_PATTERN } from "@/lib/types";

/** pitcherThrows is the linked roster pitcher's hand (R/L); null/absent when unknown or Machine BP. */
/** squaredUp is 0–1 and potentialExitVelocity is mph, both from the original CSV row; absent when not saved. */
export type SavedContact = Omit<ReviewedContact, "athleteCode"> & { pitcherThrows?: "R" | "L" | null; squaredUp?: number | null; potentialExitVelocity?: number | null };

/** Saved Squared Up / Potential EV for this athlete's readable contacts; failure leaves them absent. */
async function withSquaredUp(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string, contacts: SavedContact[]): Promise<SavedContact[]> {
  if (!contacts.length) return contacts;
  let data: unknown;
  try {
    const result = await access.supabase.rpc("athlete_contact_quality", { p_athlete: athleteId });
    if (result.error) return contacts;
    data = result.data;
  } catch { return contacts; }
  if (!Array.isArray(data)) return contacts;
  const quality = new Map<string, { squaredUp: number; potentialExitVelocity: number }>();
  for (const row of data) if (row && typeof row.file_hash === "string" && Number.isSafeInteger(row.source_row) && typeof row.squared_up === "number" && row.squared_up > 0 && row.squared_up <= 1 && typeof row.potential_exit_velocity === "number" && row.potential_exit_velocity > 0 && row.potential_exit_velocity <= 200)
    quality.set(`${row.file_hash}:${row.source_row}`, { squaredUp: row.squared_up, potentialExitVelocity: row.potential_exit_velocity });
  return contacts.map(contact => { const q = quality.get(`${contact.fileHash}:${contact.sourceRow}`); return { ...contact, squaredUp: q?.squaredUp ?? null, potentialExitVelocity: q?.potentialExitVelocity ?? null }; });
}

/** Only R/L for this athlete's own readable contacts; the reader never returns pitcher identities. */
async function withPitcherHands(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string, contacts: SavedContact[]): Promise<SavedContact[]> {
  if (!contacts.length) return contacts;
  let data: unknown;
  try {
    const result = await access.supabase.rpc("athlete_contact_pitcher_hands", { p_athlete: athleteId });
    if (result.error) return contacts;
    data = result.data;
  } catch { return contacts; }
  if (!Array.isArray(data)) return contacts;
  const hands = new Map<string, "R" | "L">();
  for (const row of data) if (row && typeof row.file_hash === "string" && Number.isSafeInteger(row.source_row) && (row.pitcher_throws === "R" || row.pitcher_throws === "L")) hands.set(`${row.file_hash}:${row.source_row}`, row.pitcher_throws);
  return contacts.map(contact => ({ ...contact, pitcherThrows: hands.get(`${contact.fileHash}:${contact.sourceRow}`) ?? null }));
}

/** RLS and the effective View-as scope both limit detailed events to this athlete. */
export async function loadFullSwingContacts(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string, context?: "in_game" | "practice"): Promise<SavedContact[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Contact-map access denied.");
  const contacts: SavedContact[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const query = access.supabase.from("full_swing_contacts")
      .select("file_hash,source_row,pitch_number,source_file,played_on,category,exit_velocity,launch_angle,direction,distance")
      .eq("athlete_id", athleteId);
    if (context) query.in("category", context === "practice" ? ["practice"] : ["game", "intrasquad"]);
    const { data, error } = await query.order("played_on", { ascending: false }).order("file_hash").order("source_row")
      .range(offset, offset + 999);
    if (error || !Array.isArray(data)) throw new Error("Full Swing contact results could not be loaded.");
    for (const row of data) {
      if (!/^[a-f0-9]{64}$/.test(row.file_hash) || !Number.isSafeInteger(row.source_row) || row.source_row < 2 ||
        !Number.isSafeInteger(row.pitch_number) || row.pitch_number < 1 ||
        typeof row.source_file !== "string" || !/^2026-\d{2}-\d{2}$/.test(row.played_on) ||
        !["game", "intrasquad", "practice"].includes(row.category) ||
        (context && (context === "practice" ? row.category !== "practice" : row.category === "practice")) ||
        typeof row.exit_velocity !== "number" || !Number.isFinite(row.exit_velocity) || row.exit_velocity <= 0 || row.exit_velocity > 200 ||
        typeof row.launch_angle !== "number" || !Number.isFinite(row.launch_angle) || Math.abs(row.launch_angle) > 90 ||
        (row.direction !== null && (typeof row.direction !== "number" || !Number.isFinite(row.direction) || Math.abs(row.direction)>90)) ||
        (row.distance !== null && (typeof row.distance !== "number" || !Number.isFinite(row.distance) || row.distance<0 || row.distance>1000)) ||
        (row.direction === null)!==(row.distance === null))
        throw new Error("Full Swing contact result format is invalid.");
      contacts.push({ fileHash: row.file_hash, sourceRow: row.source_row, pitchNumber: row.pitch_number,
        sourceFile: row.source_file, playedOn: row.played_on, category: row.category,
        exitVelocity: row.exit_velocity, launchAngle: row.launch_angle, direction: row.direction, distance: row.distance });
    }
    if (data.length < 1000) { const [hands, squared] = await Promise.all([withPitcherHands(access, athleteId, contacts), withSquaredUp(access, athleteId, contacts)]);
      return hands.map((contact, index) => ({ ...contact, squaredUp: squared[index].squaredUp ?? null, potentialExitVelocity: squared[index].potentialExitVelocity ?? null })); }
  }
  throw new Error("Contact-map history exceeds the supported size.");
}

export async function importFullSwingContacts(rows: ReviewedContact[]): Promise<{ created: number; unchanged: number }> {
  const { supabase } = await requireImportAccess();
  const { data, error } = await supabase.rpc("staff_import_full_swing_contacts", { p_rows: rows });
  if (error || !data || !Number.isSafeInteger(data.created) || !Number.isSafeInteger(data.unchanged) || data.created + data.unchanged !== rows.length)
    throw new Error("The contact-map save could not be confirmed. Check the player profile before retrying the same file.");
  return { created: data.created, unchanged: data.unchanged };
}
