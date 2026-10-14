"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./exit-meeting-handout.module.css";

/** Scales the 816px-wide letter pages to the available width on screen; printing resets to true size. */
export function HandoutFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), [zoom, setZoom] = useState(1);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setZoom(Math.min(1, Math.max(0.3, entry.contentRect.width / 830))));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={styles.fit}><div style={{ zoom }}>{children}</div></div>;
}
