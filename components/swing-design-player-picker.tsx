"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import { matchesStaffAthlete, type StaffAthleteChoice } from "@/lib/staff-athlete-search";

export function SwingDesignPlayerPicker({ players, selectedId }: { players: StaffAthleteChoice[]; selectedId: string }) {
  const router = useRouter();
  const inputId = useId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const visible = players.filter(player => matchesStaffAthlete(player, search));
  const suggestions = visible.slice(0, 8);
  const expanded = open && !!search.trim() && !pending;
  const selected = players.find(player => player.id === selectedId);
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${inputId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, inputId]);
  function choose(id: string) {
    if (pending || (id && !players.some(player => player.id === id))) return;
    setOpen(false); setActive(-1);
    startTransition(() => router.push(id ? `/swing-design?athlete=${encodeURIComponent(id)}` : "/swing-design"));
  }
  return <section className="panel mb-5 p-4 sm:p-5" aria-label="Choose a player for Swing Design" aria-busy={pending}>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative min-w-0" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
      }}>
        <label htmlFor={inputId} className="text-sm font-semibold">Find a Player</label>
        <span className="relative mt-2 block"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"/>
          <input id={inputId} className="!pl-9" type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
            aria-controls={expanded ? `${inputId}-listbox` : undefined} aria-activedescendant={expanded && suggestions[active] ? `${inputId}-option-${active}` : undefined}
            aria-describedby={`${inputId}-help`} maxLength={100} autoComplete="off" spellCheck={false} disabled={pending}
            placeholder="Name or PAC ID" value={search} onFocus={() => setOpen(true)}
            onChange={event => { setSearch(event.target.value); setOpen(true); setActive(-1); }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape") { if (expanded) event.preventDefault(); setOpen(false); setActive(-1); }
              if ((event.key === "ArrowDown" || event.key === "ArrowUp") && search.trim() && suggestions.length) {
                event.preventDefault(); setOpen(true);
                setActive(index => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length : index) - 1);
              }
              if (event.key === "Enter" && expanded && suggestions[active]) { event.preventDefault(); choose(suggestions[active].id); }
            }} />
        </span>
        <span id={`${inputId}-help`} className="sr-only">Type a name or PAC ID, then select a player. Use the arrow keys and Enter to open their swing results.</span>
        {expanded && <div className="panel absolute left-0 right-0 z-50 mt-2 overflow-hidden shadow-lg">
          <ul id={`${inputId}-listbox`} role="listbox" aria-label="Swing Design player suggestions" className="m-0 max-h-80 list-none overflow-y-auto p-1">
            {suggestions.map((player, index) => <li key={player.id} role="presentation">
              <button type="button" role="option" id={`${inputId}-option-${index}`} tabIndex={-1} aria-selected={active === index}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${active === index ? "bg-[var(--surface-raised)]" : "hover:bg-[var(--surface-raised)]"}`}
                onMouseDown={event => { if (event.button === 0) event.preventDefault(); }} onMouseMove={() => setActive(index)} onClick={() => choose(player.id)}>
                <span className="min-w-0"><span className="block break-words text-sm font-semibold">{player.name}</span><span className="block text-xs text-[var(--text-secondary)]">{player.athleteCode}</span></span>
                <ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-[var(--text-secondary)]"/>
              </button>
            </li>)}
          </ul>
          {!suggestions.length && <p className="m-0 px-4 py-3 text-sm text-[var(--text-secondary)]">No matching players. Try a first name, last name, or PAC ID.</p>}
          {visible.length > 8 && <p className="m-0 border-t border-[var(--line-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]">Showing 8 of {visible.length} matches. Keep typing to narrow the list.</p>}
        </div>}
      </div>
      <label className="min-w-0 text-sm font-semibold">Player
        <select className="mt-2" value={selectedId} disabled={pending} onChange={event => choose(event.target.value)}>
          <option value="">Select a player</option>
          {visible.map(player => <option key={player.id} value={player.id}>{player.name} · {player.athleteCode}</option>)}
          {selected && !visible.some(player => player.id === selectedId) && <option value={selected.id}>{selected.name} · {selected.athleteCode}</option>}
        </select>
      </label>
    </div>
    <p role="status" aria-live="polite" className="mt-2 flex min-h-4 items-center gap-2 text-xs text-[var(--text-secondary)]">
      {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={13} aria-hidden="true"/>Loading swing results…</> : search.trim() ? `${visible.length} matching ${visible.length === 1 ? "player" : "players"}` : "Choose a player to open their practice swing results."}
    </p>
  </section>;
}
