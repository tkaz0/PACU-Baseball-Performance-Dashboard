"use server";

import { revalidatePath } from "next/cache";
import { requireImportAccess } from "@/lib/auth";
import { canImportPresentedAccess } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { isTrendAnnotationScope, isTrendAnnotationCategory, isTrendAnnotationDate, isTrendAnnotationNote, type TrendAnnotationActionState } from "@/lib/trend-annotations";

export async function saveTrendAnnotation(_previous: TrendAnnotationActionState, form: FormData): Promise<TrendAnnotationActionState> {
  const access = await requireImportAccess();
  if (!canImportPresentedAccess(access)) return { status: "error", message: "Player View is read-only." };
  const athleteId = form.get("athleteId"), id = form.get("annotationId"), revision = form.get("revision"), date = form.get("date"), category = form.get("category"), scope = form.get("scope"), rawNote = form.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim() : rawNote;
  if (typeof athleteId !== "string" || !UUID_PATTERN.test(athleteId) || typeof id !== "string" || !UUID_PATTERN.test(id)
    || typeof revision !== "string" || !/^\d{1,9}$/.test(revision) || !isTrendAnnotationDate(date)
    || !isTrendAnnotationScope(scope) || !isTrendAnnotationCategory(category) || !isTrendAnnotationNote(note)) return { status: "invalid", message: "Choose a Fall date, category, and a note of 400 characters or fewer." };
  const { data, error } = await access.supabase.rpc("staff_save_trend_annotation", {
    p_athlete_id: athleteId, p_annotation_id: id, p_expected_revision: Number(revision), p_occurred_on: date,
    p_category: category, p_scope: scope, p_note: note, p_shared: form.get("shared") === "on", p_archived: form.get("archived") === "on",
  });
  if (error) return error.code === "40001"
    ? { status: "stale", message: "This note changed. Refresh this profile before editing again." }
    : { status: "error", message: "The save could not be confirmed. Refresh this profile to check the note before trying again. Dates must be on or before today." };
  if (!data || data.id !== id || data.revision !== Number(revision) + 1) return { status: "unverified", message: "The save could not be confirmed. Refresh this profile to check the note before trying again." };
  revalidatePath(`/athletes/${athleteId}`);
  return { status: "saved", message: "Coaching note saved." };
}
