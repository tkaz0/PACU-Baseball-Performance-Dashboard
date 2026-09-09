"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { matchesStaffAthlete, type StaffAthleteChoice } from "@/lib/staff-athlete-search";

export function StaffAthleteSearch({ athletes, defaultQuery = "", name, compact = false }: {
  athletes: StaffAthleteChoice[]; defaultQuery?: string; name?: string; compact?: boolean;
}) {
  const id = useId(), router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(defaultQuery.slice(0, 100));
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const matches = query.trim() ? athletes.filter(athlete => matchesStaffAthlete(athlete, query)) : [];
  const suggestions = matches.slice(0, 8), expanded = open && !!query.trim();
  const optionId = (index: number) => `${id}-option-${index}`;
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, id]);
  return <div className={`relative min-w-0 ${compact ? "staff-player-search-compact w-full sm:w-56" : "min-w-[180px] flex-1"}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <label htmlFor={id} className={compact ? "sr-only" : "block"}>{compact ? "Find a player" : "Search athletes"}</label>
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
      <input ref={inputRef} id={id} name={name} value={query} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
        aria-controls={expanded ? `${id}-listbox` : undefined} aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        aria-describedby={`${id}-help`} autoComplete="off" spellCheck={false} maxLength={100}
        placeholder={compact ? "Find a player…" : "Name or PAC ID"} className={`!pl-9 !pr-10 ${compact ? "!min-h-10 !py-2 text-sm" : ""}`}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { if (expanded) event.preventDefault(); setOpen(false); setActive(-1); }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
            event.preventDefault(); setOpen(true);
            setActive(index => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length : index) - 1);
          }
          if (event.key === "Enter" && expanded && active >= 0 && suggestions[active]) {
            event.preventDefault(); setOpen(false); setActive(-1); router.push(`/athletes/${suggestions[active].id}`);
          }
        }} />
      {query && <button type="button" aria-label="Clear player search" className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]" onClick={() => { setQuery(""); setActive(-1); setOpen(false); inputRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
    </div>
    <span id={`${id}-help`} className="sr-only">Type a player name or PAC ID. Use the arrow keys to choose a suggestion and Enter to open the profile.</span>
    <span className="sr-only" role="status" aria-live="polite">{expanded ? matches.length ? `${matches.length} player ${matches.length === 1 ? "match" : "matches"}. ${matches.length > 8 ? "Showing the first 8." : ""}` : "No matching players." : ""}</span>
    {expanded && <div className="panel absolute left-0 right-0 z-50 mt-2 overflow-hidden shadow-lg">
      <ul id={`${id}-listbox`} role="listbox" aria-label="Player suggestions" className="m-0 max-h-80 list-none overflow-y-auto p-1">
        {suggestions.map((athlete, index) => <li key={athlete.id} role="presentation"><Link id={optionId(index)} role="option"
          aria-selected={active === index} href={`/athletes/${athlete.id}`} prefetch={false} tabIndex={-1}
          className={`flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 !text-inherit !no-underline ${active === index ? "bg-[var(--surface-raised)]" : "hover:bg-[var(--surface-raised)]"}`}
          onMouseDown={event => { if (event.button === 0) event.preventDefault(); }} onMouseMove={() => setActive(index)} onClick={() => { setOpen(false); setActive(-1); }}>
          <span className="min-w-0"><span className="block break-words text-sm font-semibold">{athlete.name}</span><span className="block text-xs text-[var(--text-secondary)]">{athlete.athleteCode}</span></span><ArrowUpRight size={16} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        </Link></li>)}
      </ul>
      {!suggestions.length && <p className="muted m-0 px-4 py-3 text-sm">No matching players. Try a first name, last name, or PAC ID.</p>}
      {matches.length > 8 && <p className="muted m-0 border-t border-[var(--line-subtle)] px-4 py-2 text-xs">Showing 8 of {matches.length} matches. Keep typing to narrow the list.</p>}
    </div>}
  </div>;
}
