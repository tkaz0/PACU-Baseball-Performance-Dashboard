"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./exit-meeting-handout.module.css";

/**
 * Screen: scales the 816px-wide letter pages to the available width. Both screen and print: if a
 * page's content is taller than the page (for example a two-way player), its body is zoomed down so
 * nothing is cut off. Values never change, only their size.
 */
export function HandoutFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), [zoom, setZoom] = useState(1);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setZoom(Math.min(1, Math.max(0.3, entry.contentRect.width / 830))));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    for (const body of ref.current?.querySelectorAll<HTMLElement>("[data-page-body]") ?? []) {
      body.style.zoom = "1";
      const page = body.parentElement!, available = page.clientHeight - 34, natural = body.scrollHeight;
      if (natural > available + 1) body.style.zoom = String(Math.max(0.7, available / natural));
    }
  });
  return <div ref={ref} className={styles.fit}><div style={{ zoom }}>{children}</div></div>;
}
