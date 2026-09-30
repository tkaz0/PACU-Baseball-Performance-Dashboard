"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { matchesStaffAthlete, type StaffAthleteChoice } from "@/lib/staff-athlete-search";
import styles from "./graphics-studio.module.css";

/** One searchable field, with exact existing roster choices and keyboard selection. */
export function GraphicsPlayerPicker({ players, value, onChange, label = "Player" }: {
  players: StaffAthleteChoice[]; value: string; onChange: (id: string) => void; label?: string;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(-1);
  const selected = players.find(player => player.id === value);
  const matches = players.filter(player => matchesStaffAthlete(player, query));
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [id, open, active]);
  function choose(playerId: string) { onChange(playerId); setOpen(false); setQuery(""); setActive(-1); }
  return <div className={styles.playerPicker} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(""); setActive(-1); }
  }}>
    <label htmlFor={id} className={styles.controlLabel}>{label}</label>
    <div className={styles.playerInput}>
      <Search size={16} aria-hidden="true" />
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        value={open ? query : selected?.name ?? ""} placeholder="Choose a player" autoComplete="off" spellCheck={false} maxLength={100}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); setActive(-1); }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matches.length) {
            event.preventDefault(); setOpen(true); setActive(index => event.key === "ArrowDown" ? (index + 1) % matches.length : (index <= 0 ? matches.length : index) - 1);
          }
          if (event.key === "Enter" && open && matches[active >= 0 ? active : 0]) { event.preventDefault(); choose(matches[active >= 0 ? active : 0].id); }
        }} />
      <ChevronDown size={15} aria-hidden="true" />
    </div>
    {open && <div className={styles.playerMenu}>
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} options`}>
        {matches.map((player, index) => <li role="option" id={`${id}-${index}`} key={player.id} aria-selected={player.id === value} data-active={active === index}
          onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(player.id)}>
          <span>{player.name}</span>{player.id === value && <Check size={15} aria-hidden="true" />}
        </li>)}
      </ul>
      {!matches.length && <p>No matching players.</p>}
    </div>}
  </div>;
}
