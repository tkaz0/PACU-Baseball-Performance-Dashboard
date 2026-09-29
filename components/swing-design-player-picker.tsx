"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { matchesStaffAthlete, type StaffAthleteChoice } from "@/lib/staff-athlete-search";

export function SwingDesignPlayerPicker({ players, selectedId }: { players: StaffAthleteChoice[]; selectedId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = players.filter(player => matchesStaffAthlete(player, search));
  const selected = players.find(player => player.id === selectedId);
  return <section className="panel mb-5 p-4 sm:p-5" aria-label="Choose a player for Swing Design" aria-busy={pending}>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-semibold">Find a Player
        <span className="relative mt-2 block"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"/>
          <input className="!pl-9" type="search" maxLength={100} autoComplete="off" placeholder="Name or PAC ID" value={search} onChange={event => setSearch(event.target.value)} />
        </span>
      </label>
      <label className="min-w-0 text-sm font-semibold">Player
        <select className="mt-2" value={selectedId} disabled={pending} onChange={event => {
          const id = event.target.value;
          startTransition(() => router.push(id ? `/swing-design?athlete=${encodeURIComponent(id)}` : "/swing-design"));
        }}>
          <option value="">Select a player</option>
          {visible.map(player => <option key={player.id} value={player.id}>{player.name} · {player.athleteCode}</option>)}
          {selected && !visible.some(player => player.id === selectedId) && <option value={selected.id}>{selected.name} · {selected.athleteCode}</option>}
        </select>
      </label>
    </div>
    <p role="status" aria-live="polite" className="mt-2 flex min-h-4 items-center gap-2 text-xs text-[var(--text-secondary)]">
      {pending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={13} aria-hidden="true"/>Loading swing results…</> : search ? `${visible.length} matching players` : "Choose a player to open their practice swing results."}
    </p>
  </section>;
}
