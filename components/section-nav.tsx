"use client";
import { useEffect, useRef, useState } from "react";
import { activeSectionAt, sectionFromHash } from "@/lib/section-navigation";
import styles from "./section-nav.module.css";

/** Sticky in-page section links that highlight the section currently in view. */
export function SectionNav({ items, label }: { items: readonly { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const targets = items.map(item => document.getElementById(item.id)).filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const followHash = () => {
      const id = sectionFromHash(window.location.hash, targets.map(target => target.id));
      const target = targets.find(target => target.id === id);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: "start" });
      setActive(target.id);
    };
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      if (!nav.current || typeof IntersectionObserver === "undefined") return;
      // A one-pixel reading line just below the sticky bar works on both phone and desktop.
      const stickyTop = Number.parseFloat(getComputedStyle(nav.current).top) || 0;
      const line = Math.min(window.innerHeight - 1, stickyTop + nav.current.offsetHeight + 16);
      observer = new IntersectionObserver(() => {
        const id = activeSectionAt(targets.map(target => {
          const { top, bottom } = target.getBoundingClientRect();
          return { id: target.id, top, bottom };
        }), line);
        if (id) setActive(id);
      }, { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` });
      targets.forEach(target => observer!.observe(target));
    };
    observe();
    const frame = requestAnimationFrame(followHash);
    window.addEventListener("hashchange", followHash);
    window.addEventListener("resize", observe);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("hashchange", followHash);
      window.removeEventListener("resize", observe);
    };
  }, [items]);
  return <nav ref={nav} className={styles.nav} aria-label={label}>{items.map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(item.id);
    if (target instanceof HTMLDetailsElement) target.open = true;
    setActive(item.id);
  }}>{item.label}</a>)}</nav>;
}
