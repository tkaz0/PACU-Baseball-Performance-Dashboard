"use client";
import { useEffect, useState } from "react";
import styles from "./section-nav.module.css";

/** Sticky in-page section links that highlight the section currently in view. */
export function SectionNav({ items, label }: { items: readonly { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const targets = items.map(item => document.getElementById(item.id)).filter((el): el is HTMLElement => !!el);
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-120px 0px -55% 0px" });
    targets.forEach(t => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);
  return <nav className={styles.nav} aria-label={label}>{items.map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined} onClick={() => setActive(item.id)}>{item.label}</a>)}</nav>;
}
