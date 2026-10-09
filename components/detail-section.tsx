import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./detail-section.module.css";

/** Native disclosure: keyboard accessible, with no client bundle or saved preference. */
export function DetailSection({ title, description, open = false, children }: {
  title: string;
  description?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return <details className={styles.section} open={open}>
    <summary><span><strong>{title}</strong>{description && <small>{description}</small>}</span><ChevronDown size={19} aria-hidden="true" /></summary>
    <div className={styles.content}>{children}</div>
  </details>;
}
