import "server-only";
import { requireRenderAccess } from "@/lib/render-access";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { loadPitchGradeSource } from "@/lib/analytics-server";
import { loadContactsAllowed } from "@/lib/contacts-allowed-server";
import { loadGameStats } from "@/lib/game-server";
import { fallArsenalPitches } from "@/lib/pitch-arsenal";
import { pacificTestingDate } from "@/lib/testing-checklist";
import { ownPitchGrades, parsePitchGradeBaselines, pitchGrades, playerVisibleBaselines, type PitchGradeBaselines } from "@/lib/pitch-grades";
import type { AllowedContact } from "@/lib/contacts-allowed";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import type { Measurement } from "@/lib/imports/engine";

type Access = Awaited<ReturnType<typeof requireRenderAccess>>;
const stable = (b: PitchGradeBaselines) => JSON.stringify(b, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [z]) => a.localeCompare(z))) : v);

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
  const result = pitchGrades(source.players, source.games, source.arsenals, contacts);
  // Publish the aggregate-only player baseline when every pitcher's contact loaded and it changed.
  if (!unavailable) await publishBaselines(access, playerVisibleBaselines(result.baselines)).catch(() => undefined);
  return { ...result, contactUnavailable: unavailable };
}

async function publishBaselines(access: Access, baselines: PitchGradeBaselines) {
  const { data } = await access.supabase.from("pitch_grade_baselines").select("payload").eq("id", 1).maybeSingle();
  const saved = parsePitchGradeBaselines(data?.payload);
  if (saved && stable(saved) === stable(baselines)) return;
  const { error } = await access.supabase.rpc("staff_save_pitch_grade_baselines", { p_payload: baselines });
  if (error) throw new Error("Pitch grade baselines could not be saved.");
}

/** A pitcher's own grades from their own arsenal, sheet counts and contact against, versus the published team baselines. */
export async function loadOwnPitchGrades(access: Access, player: CoachingPlayer, measurements: readonly Measurement[], contacts: readonly AllowedContact[] | null) {
  if (!canReadPresentedAthlete(access, player.id)) throw new Error("Pitch grade access denied.");
  const [{ data, error }, stats] = await Promise.all([
    access.supabase.from("pitch_grade_baselines").select("payload,computed_at").eq("id", 1).maybeSingle(),
    loadGameStats(access, player.id),
  ]);
  if (error) throw new Error("Pitch grade baselines could not be loaded.");
  const baselines = parsePitchGradeBaselines(data?.payload);
  if (!baselines || typeof data?.computed_at !== "string") return null;
  const rows = ownPitchGrades(player, stats, fallArsenalPitches(measurements, pacificTestingDate()), contacts ?? [], baselines);
  return { rows, computedAt: data.computed_at, contactUnavailable: contacts === null };
}
