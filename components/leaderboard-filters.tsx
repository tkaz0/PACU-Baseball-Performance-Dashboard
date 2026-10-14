"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import styles from "./leaderboard.module.css";

type Position = "all" | "pitchers" | "position";
const CHIPS: { value: Position; label: string }[] = [{ value: "all", label: "Everyone" }, { value: "pitchers", label: "Pitchers" }, { value: "position", label: "Position Players" }];

/** Chips and a search box that update the URL as you type; ranks and team averages still use the whole team. */
export function LeaderboardFilters({ base, position, search, showPositions }: { base: string; position: Position; search: string; showPositions: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const first = useRef(true);
  const href = (pos: Position, q: string) => `${base}${pos !== "all" ? `&pos=${pos}` : ""}${q.trim() ? `&q=${encodeURIComponent(q.trim().slice(0, 60))}` : ""}`;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const timer = window.setTimeout(() => router.replace(href(position, query), { scroll: false }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the typed text changes
  }, [query]);
  return <div className={styles.filterBar} role="search" aria-label="Filter players">
    {showPositions && <nav className={styles.chips} aria-label="Player group">{CHIPS.map(chip => <Link key={chip.value} href={href(chip.value, query)} scroll={false} replace aria-current={position === chip.value ? "true" : undefined}>{chip.label}</Link>)}</nav>}
    <label className={styles.searchBox}><Search size={15} aria-hidden="true"/><span className="sr-only">Find a player</span>
      <input type="search" value={query} maxLength={60} placeholder="Find a player or jersey #" onChange={e => setQuery(e.target.value)}/>
      {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}
    </label>
  </div>;
}
