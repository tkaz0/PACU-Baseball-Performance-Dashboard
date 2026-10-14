"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChartNoAxesCombined, ChevronDown } from "lucide-react";
import styles from "./chart-disclosure.module.css";

/** Presentation only: both views use the same authorized, already-loaded results. */
export function ChartDisclosure({ title, description, preview, children, collapseDisabled = false }: {
  title: string; description?: string; preview: ReactNode; children: ReactNode; collapseDisabled?: boolean;
}) {
  const id = useId(), [expanded, setExpanded] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  function toggle() {
    if (expanded) content.current?.querySelectorAll("video, audio").forEach(element => (element as HTMLMediaElement).pause());
    setExpanded(value => !value);
  }
  return <section className={styles.card} aria-label={title} data-testid="chart-disclosure">
    <header className={styles.header}><div className={styles.heading}><ChartNoAxesCombined size={18} aria-hidden="true"/><div><h2 id={`${id}-title`}>{title}</h2>{description && <p>{description}</p>}</div></div>
      <button type="button" aria-expanded={expanded} aria-controls={`${id}-chart`} disabled={expanded && collapseDisabled} onClick={toggle}>{expanded ? "Collapse" : "Explore Chart"}<ChevronDown size={16} aria-hidden="true"/></button>
    </header>
    {!expanded && <div className={styles.preview}>{preview}</div>}
    <div ref={content} id={`${id}-chart`} hidden={!expanded} aria-labelledby={`${id}-title`} className={styles.content}>{children}</div>
  </section>;
}
