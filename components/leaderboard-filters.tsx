"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import styles from "./leaderboard.module.css";

type Position = "all" | "pitchers" | "position";
const CHIPS: { value: Position; label: string }[] = [{ value: "all", label: "Everyone" }, { value: "pitchers", label: "Pitchers" }, { value: "position", label: "Position Players" }];

export function leaderboardFilterHref(base: string, position: Position, search: string) {
  return `${base}${position !== "all" ? `&pos=${position}` : ""}${search.trim() ? `&q=${encodeURIComponent(search.trim().slice(0, 60))}` : ""}`;
}

/** A new category/group starts from its URL, while a search response keeps focus and newer typing. */
export function LeaderboardFilters(props: { base: string; position: Position; search: string; showPositions: boolean }) {
  return <SearchFilters key={`${props.base}:${props.position}`} {...props}/>;
}

function SearchFilters({ base, position, search, showPositions }: { base: string; position: Position; search: string; showPositions: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);
  const [requested, setRequested] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Server responses can arrive after the user has typed more. Only external URL changes
  // replace the draft; our own responses must not erase the next search or move focus.
  if (search !== lastSearch) {
    setLastSearch(search);
    if (!requested.has(search)) setQuery(search);
  }

  useEffect(() => {
    const cancel = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
    const leave = () => {
      cancel();
      setRequested(new Set());
      setQuery(new URL(window.location.href).searchParams.get("q") ?? "");
    };
    const onLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link instanceof HTMLAnchorElement && link.target !== "_blank" && !link.hasAttribute("download")) {
        cancel();
        setRequested(new Set());
        setQuery(new URL(link.href).searchParams.get("q") ?? "");
      }
    };
    // Cancel before navigation starts, even if the next server response takes longer
    // than the debounce. Otherwise a late search can send the user back to this tab.
    document.addEventListener("click", onLink, true);
    window.addEventListener("popstate", leave);
    return () => { cancel(); document.removeEventListener("click", onLink, true); window.removeEventListener("popstate", leave); };
  }, []);

  function update(value: string) {
    setQuery(value);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = value.trim().slice(0, 60);
      setRequested(previous => new Set([...previous, next]));
      startTransition(() => router.replace(leaderboardFilterHref(base, position, next), { scroll: false }));
      timer.current = null;
    }, 300);
  }

  return <div className={styles.filterBar} role="search" aria-label="Filter players" aria-busy={pending}>
    {showPositions && <nav className={styles.chips} aria-label="Player group">{CHIPS.map(chip => <Link key={chip.value} href={leaderboardFilterHref(base, chip.value, query)} prefetch={false} scroll={false} replace aria-current={position === chip.value ? "true" : undefined}>{chip.label}</Link>)}</nav>}
    <label className={`${styles.searchBox} flex`}><Search size={15} aria-hidden="true"/><span className="sr-only">Find a player</span>
      <input ref={input} type="search" aria-label="Find a player" value={query} maxLength={60} placeholder="Find a player or jersey #" onChange={e => update(e.target.value)}/>
      {query && <button type="button" aria-label="Clear search" onClick={() => { update(""); input.current?.focus(); }}><X size={16} aria-hidden="true"/></button>}
    </label>
    {(position !== "all" || query) && <Link className={styles.resetFilters} href={base} prefetch={false} replace scroll={false} onClick={() => setQuery("")}>Reset filters</Link>}
    <span className="sr-only" role="status">{pending ? "Updating player results" : ""}</span>
  </div>;
}
