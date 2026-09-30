import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canImportPresentedAccess, canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { isTrendAnnotationScope, isTrendAnnotationCategory, isTrendAnnotationDate, isTrendAnnotationNote, type TrendAnnotation } from "@/lib/trend-annotations";

type Access = Awaited<ReturnType<typeof requireAccess>>;
export async function loadTrendAnnotations(access: Access, athleteId: string): Promise<TrendAnnotation[]> {
  if (!UUID_PATTERN.test(athleteId) || !canReadPresentedAthlete(access, athleteId)) throw new Error("Coaching note access denied.");
  const { data, error } = await access.supabase.rpc("athlete_trend_annotations", { p_athlete_id: athleteId });
  if (error) throw new Error("Coaching notes could not be loaded.");
  if (!Array.isArray(data) || data.length > 100) throw new Error("Coaching note format is invalid.");
  const staff = canImportPresentedAccess(access);
  const notes = data.map((value: unknown): TrendAnnotation => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Coaching note format is invalid.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !UUID_PATTERN.test(item.id) || item.athleteId !== athleteId || !isTrendAnnotationDate(item.date)
      || !isTrendAnnotationScope(item.scope) || !isTrendAnnotationCategory(item.category) || !isTrendAnnotationNote(item.note) || typeof item.shared !== "boolean"
      || typeof item.archived !== "boolean" || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1
      || typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) throw new Error("Coaching note format is invalid.");
    // Exact allowlist; the actual admin session may return staff notes in Player View as.
    return { id: item.id as string, athleteId, date: item.date, category: item.category, scope: item.scope, note: item.note,
      shared: item.shared, archived: item.archived, revision: item.revision as number, createdAt: item.createdAt };
  });
  if (new Set(notes.map(note => note.id)).size !== notes.length) throw new Error("Duplicate coaching notes.");
  return notes.filter(item => staff || (item.shared && !item.archived));
}
