"use client";

import { useActionState } from "react";
import { saveTrendAnnotation } from "@/app/(workspace)/athletes/[id]/trend-annotation-actions";
import { TREND_ANNOTATION_CATEGORIES, TREND_ANNOTATION_SCOPES, type TrendAnnotation, type TrendAnnotationActionState } from "@/lib/trend-annotations";
import styles from "./trend-annotations.module.css";

const initial: TrendAnnotationActionState = { status: "idle" };
export function TrendAnnotationForm({ athleteId, item, newId, today }: { athleteId: string; item?: TrendAnnotation; newId?: string; today: string }) {
  const [state, action, pending] = useActionState(saveTrendAnnotation, initial);
  const needsRefresh = ["stale", "error", "unverified", "saved"].includes(state.status);
  return <form action={action} className={styles.form}>
    <input type="hidden" name="athleteId" value={athleteId}/>
    <input type="hidden" name="annotationId" value={item?.id ?? newId}/>
    <input type="hidden" name="revision" value={item?.revision ?? 0}/>
    <fieldset disabled={pending || needsRefresh}>
      <div className={styles.fields}>
        <label>Date of Change<input type="date" name="date" required min="2026-09-01" max={today < "2026-12-31" ? today : "2026-12-31"} defaultValue={item?.date ?? (today <= "2026-12-31" && today >= "2026-09-01" ? today : "")}/></label>
        <label>Category<select name="category" defaultValue={item?.category ?? "other"}>{TREND_ANNOTATION_CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label>
        <label>Show On<select name="scope" defaultValue={item?.scope ?? "all"}>{TREND_ANNOTATION_SCOPES.map(scope => <option key={scope.key} value={scope.key}>{scope.label}</option>)}</select></label>
      </div>
      <label>Coaching Note<textarea name="note" required rows={2} maxLength={400} defaultValue={item?.note ?? ""} placeholder="e.g. Started using a slightly wider stance"/></label>
      <div className={styles.options}>
        <label><input type="checkbox" name="shared" defaultChecked={item?.shared ?? false}/>Share this note with the player</label>
        {item && <label><input type="checkbox" name="archived" defaultChecked={item.archived}/>Archive this note</label>}
      </div>
      <button type="submit" className="btn btn-primary">{pending ? "Saving…" : item ? "Save Changes" : "Add Coaching Note"}</button>
    </fieldset>
    {state.message && <p role={state.status === "saved" ? "status" : "alert"} className={styles.feedback}>{state.message} {needsRefresh && <a href={`/athletes/${athleteId}#coaching-notes`}>Refresh Profile</a>}</p>}
  </form>;
}
