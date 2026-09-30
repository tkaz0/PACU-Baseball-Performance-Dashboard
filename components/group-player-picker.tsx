"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, Users, X } from "lucide-react";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import { groupPresets } from "@/lib/group-comparison";
import styles from "./group-player-picker.module.css";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const uniquePlayers = (players: readonly CoachingPlayer[]) => [...new Map(players.map(player => [player.id, player])).values()];

export function filterGroupPlayers(players: readonly CoachingPlayer[], query: string): CoachingPlayer[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return uniquePlayers(players).filter(player => {
    const searchable = normalize([player.name, player.code, player.position, player.secondaryPosition, player.playerType.replace(/_/g, " ")].filter(Boolean).join(" "));
    return terms.every(term => searchable.includes(term));
  });
}

/** Keep the full authorized roster order, with no selection limit or stale IDs. */
export function groupPickerSelection(players: readonly CoachingPlayer[], selectedIds: readonly string[]): string[] {
  const selected = new Set(selectedIds);
  return uniquePlayers(players).filter(player => selected.has(player.id)).map(player => player.id);
}

export function toggleGroupPlayer(players: readonly CoachingPlayer[], selectedIds: readonly string[], playerId: string): string[] {
  const selected = new Set(groupPickerSelection(players, selectedIds));
  if (players.some(player => player.id === playerId)) {
    if (selected.has(playerId)) selected.delete(playerId);
    else selected.add(playerId);
  }
  return groupPickerSelection(players, [...selected]);
}

export function GroupPlayerPicker({ players, selectedIds, onChange }: {
  players: CoachingPlayer[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const roster = uniquePlayers(players);
  const selected = new Set(groupPickerSelection(roster, selectedIds));
  const matches = filterGroupPlayers(roster, query);
  const presets = groupPresets(roster);
  const activePreset = selected.size ? presets.find(preset => preset.playerIds.length === selected.size && preset.playerIds.every(playerId => selected.has(playerId))) : undefined;

  useEffect(() => { if (open) search.current?.focus(); }, [open]);

  function show() {
    setQuery("");
    dialog.current?.showModal();
    setOpen(true);
  }

  function close() { dialog.current?.close(); }

  return <div className={styles.picker}>
    <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} onClick={show}>
      <Users size={17} aria-hidden="true" />
      <span className={styles.triggerLabel}>Choose Players</span>
      <span className={styles.badge}>{selected.size}<span className={styles.srOnly}> selected</span></span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>

    <dialog ref={dialog} id={`${id}-dialog`} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`}>Choose Players</h2>
          <p id={`${id}-help`}>Start with a group, then add or remove players.</p>
        </div>
        <button type="button" className={styles.close} aria-label="Close player selection" onClick={close}><X size={19} aria-hidden="true" /></button>
      </header>

      <div className={styles.controls}>
        <label className={styles.groupLabel} htmlFor={`${id}-group`}>Select Group</label>
        <select id={`${id}-group`} className={styles.groupSelect} value={activePreset?.id ?? ""} onChange={event => {
          const preset = presets.find(item => item.id === event.target.value);
          if (preset) { onChange(groupPickerSelection(roster, preset.playerIds)); setQuery(""); }
        }}>
          <option value="" disabled>{selected.size ? "Custom selection" : "Choose a group"}</option>
          <optgroup label="Roster groups">{presets.filter(preset => !preset.id.startsWith("position-")).map(preset => <option key={preset.id} value={preset.id} disabled={!preset.playerIds.length}>{preset.label} ({preset.playerIds.length})</option>)}</optgroup>
          <optgroup label="Exact positions">{presets.filter(preset => preset.id.startsWith("position-")).map(preset => <option key={preset.id} value={preset.id} disabled={!preset.playerIds.length}>{preset.label} ({preset.playerIds.length})</option>)}</optgroup>
        </select>
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input ref={search} type="search" aria-label="Search players by name, PAC ID, or position" aria-controls={`${id}-roster`} placeholder="Search name, PAC ID, or position" autoComplete="off" spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className={styles.listHeading}>
          <p role="status">{selected.size} selected <span aria-hidden="true">·</span> {query.trim() ? `${matches.length} of ${roster.length} players` : `Full roster · ${roster.length} players`}</p>
          <button type="button" className={styles.clear} disabled={!selected.size} onClick={() => onChange([])}>Clear All</button>
        </div>
      </div>

      <fieldset id={`${id}-roster`} className={styles.list}>
        <legend className={styles.srOnly}>Players to compare</legend>
        {matches.map((player, index) => <label key={player.id} className={styles.player} data-selected={selected.has(player.id)}>
          <input type="checkbox" checked={selected.has(player.id)} aria-label={player.name} aria-describedby={`${id}-player-${index}`} onChange={() => onChange(toggleGroupPlayer(roster, selectedIds, player.id))} />
          <span className={styles.playerText}>
            <strong>{player.name}</strong>
            <small id={`${id}-player-${index}`}>{[player.code, ...new Set([player.position, player.secondaryPosition].filter(Boolean))].filter(Boolean).join(" · ")}</small>
          </span>
        </label>)}
        {!matches.length && <p className={styles.empty}>{roster.length ? "No players match your search. Try a name, PAC ID, or position." : "No players are available in this roster."}</p>}
      </fieldset>

      <footer className={styles.footer}>
        <span>{selected.size} {selected.size === 1 ? "player" : "players"} selected</span>
        <button type="button" className={styles.done} onClick={close}>Done</button>
      </footer>
    </dialog>
  </div>;
}
