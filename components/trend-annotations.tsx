import { randomUUID } from "node:crypto";
import { Flag } from "lucide-react";
import { trendAnnotationScopeLabel, trendAnnotationCategoryLabel, type TrendAnnotation } from "@/lib/trend-annotations";
import { TrendAnnotationForm } from "@/components/trend-annotation-form";
import styles from "./trend-annotations.module.css";

const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export function TrendAnnotations({ items, athleteId, staff, today }: { items: TrendAnnotation[]; athleteId: string; staff: boolean; today: string }) {
  const visible = items.filter(item => staff || (item.shared && !item.archived));
  if (!staff && !visible.length) return null;
  const active = visible.filter(item => !item.archived), archived = visible.filter(item => item.archived);
  const card = (item: TrendAnnotation) => <article key={item.id} className={styles.card}>
    <header><span className={styles.category}>{trendAnnotationCategoryLabel(item.category)}</span><time dateTime={item.date}>{dateLabel(item.date)}</time></header>
    <p>{item.note}</p><div className={styles.visibility}>{trendAnnotationScopeLabel(item.scope)}</div>
    {staff && <div className={styles.visibility}>{item.archived ? "Archived" : item.shared ? "Shared with Player" : "Staff Only"}</div>}
    {staff && <details className={styles.edit}><summary>Edit Note</summary><TrendAnnotationForm key={`${item.id}-${item.revision}`} athleteId={athleteId} item={item} today={today}/></details>}
  </article>;
  return <section id="coaching-notes" aria-label="Coaching notes" className={styles.section}>
    <header className={styles.heading}><div><p>Progress Context</p><h2><Flag size={18} aria-hidden="true"/>Coaching Notes</h2></div><span>{active.length} {active.length === 1 ? "Note" : "Notes"}</span></header>
    <p className={styles.hint}>{staff ? "Mark grip, stance, cue, or training changes. Share a note when you want the player to see it." : "Changes and cues your coaches have shared with you."} Dated markers appear on testing charts when they fall within the chart dates.</p>
    {active.length ? <div className={styles.grid}>{active.map(card)}</div> : <p className={styles.empty}>Add context as players make adjustments.</p>}
    {staff && visible.length < 100 && <details className={styles.add}><summary>Add Coaching Note</summary><TrendAnnotationForm athleteId={athleteId} newId={randomUUID()} today={today}/></details>}
    {staff && !!archived.length && <details className={styles.add}><summary>Archived Notes · {archived.length}</summary><div className={styles.grid}>{archived.map(card)}</div></details>}
  </section>;
}
