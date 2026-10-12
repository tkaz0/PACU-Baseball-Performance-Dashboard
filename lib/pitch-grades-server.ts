import "server-only";
import { requireRenderAccess } from "@/lib/render-access";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { loadPitchGradeSource } from "@/lib/analytics-server";
import { loadContactsAllowed } from "@/lib/contacts-allowed-server";
import { pitchGrades } from "@/lib/pitch-grades";
import type { AllowedContact } from "@/lib/contacts-allowed";

/** Staff only: team-relative grades need every pitcher's counts, arsenal and contact against. */
export async function loadPitchGrades() {
  const access = await requireRenderAccess(["admin", "coach"]);
  if (!canImportPresentedAccess(access)) throw new Error("Pitch grades are available to staff.");
  const source = await loadPitchGradeSource();
  const pitcherIds = source.arsenals.map(a => a.athleteId);
  const contacts = new Map<string, AllowedContact[]>();
  let unavailable = 0;
  for (let i = 0; i < pitcherIds.length; i += 6) {
    await Promise.all(pitcherIds.slice(i, i + 6).map(async id => {
      try { contacts.set(id, await loadContactsAllowed(access, id)); } catch { unavailable++; }
    }));
  }
  return { ...pitchGrades(source.players, source.games, source.arsenals, contacts), contactUnavailable: unavailable };
}
