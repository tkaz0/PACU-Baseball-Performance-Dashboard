import "server-only";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { requireAccess, requireImportAccess } from "@/lib/auth";
import type { ReviewedContact } from "@/lib/imports/full-swing-contacts";
import { UUID_PATTERN } from "@/lib/types";

export type SavedContact = Omit<ReviewedContact, "athleteCode">;

/** RLS and the effective View-as scope both limit detailed events to this athlete. */
export async function loadFullSwingContacts(access: Awaited<ReturnType<typeof requireAccess>>, athleteId: string): Promise<SavedContact[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Contact-map access denied.");
  const contacts: SavedContact[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await access.supabase.from("full_swing_contacts")
      .select("file_hash,source_row,pitch_number,source_file,played_on,category,exit_velocity,launch_angle,direction,distance")
      .eq("athlete_id", athleteId).order("played_on", { ascending: false }).order("file_hash").order("source_row")
      .range(offset, offset + 999);
    if (error || !Array.isArray(data)) throw new Error("Full Swing contact results could not be loaded.");
    for (const row of data) {
      if (!/^[a-f0-9]{64}$/.test(row.file_hash) || !Number.isSafeInteger(row.source_row) || row.source_row < 2 ||
        !Number.isSafeInteger(row.pitch_number) || row.pitch_number < 1 ||
        typeof row.source_file !== "string" || !/^2026-\d{2}-\d{2}$/.test(row.played_on) ||
        !["game", "intrasquad", "practice"].includes(row.category) ||
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
    if (data.length < 1000) return contacts;
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
