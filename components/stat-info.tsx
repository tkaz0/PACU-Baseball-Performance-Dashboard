"use client";

import { useId } from "react";
import { Info, X } from "lucide-react";
import { statDefinition } from "@/lib/stat-definitions";
import styles from "./stat-info.module.css";

/** Native popover supports touch, keyboard, Escape, outside dismissal and focus return. */
export function StatInfo({ metric, label = metric }: { metric: string; label?: string }) {
  const id = useId();
  return <span className={styles.wrapper}>
    <button type="button" className={styles.trigger} popoverTarget={id} aria-label={`About ${label}`} title={`About ${label}`}><Info size={14} aria-hidden="true" /></button>
    <span id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className={styles.popover}>
      <span className={styles.heading}><strong id={`${id}-title`}>{label.replaceAll("_", " ")}</strong><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close stat explanation" className={styles.close}><X size={17} aria-hidden="true" /></button></span>
      <span className={styles.description}>{statDefinition(metric)}</span>
    </span>
  </span>;
}
