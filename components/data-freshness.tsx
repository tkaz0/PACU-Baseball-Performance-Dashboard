import { Clock } from "lucide-react";
import { missingWeeksLabel, type MissingWeek } from "@/lib/data-freshness";
import styles from "./data-freshness.module.css";

/** Small "not in yet" banner so stale numbers are never mistaken for current ones. */
export function DataFreshness({ source, weeks, updatedAt, children }: { source: string; weeks: readonly MissingWeek[]; updatedAt?: string | null; children?: React.ReactNode }) {
  if (!weeks.length) return null;
  const changed = updatedAt ? new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : null;
  return <p className={styles.banner} role="status" data-testid="data-freshness">
    <Clock size={15} aria-hidden="true" />
    <span><strong>{missingWeeksLabel(weeks)} not in {source} yet.</strong>{changed ? ` Last changed ${changed}.` : ""}{children ? <> {children}</> : null}</span>
  </p>;
}
