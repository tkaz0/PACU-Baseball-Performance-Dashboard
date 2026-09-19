"use client";

import Form from "next/form";
import type { LeaderboardSession } from "@/lib/leaderboards";

export function LeaderboardPitchSelector({ pitches, selectedPitch, session }: { pitches: readonly string[]; selectedPitch: string; session: LeaderboardSession }) {
  return <Form action="/leaderboards" scroll={false} className="min-w-0 sm:w-64">
    <input type="hidden" name="group" value="pitching" />
    <input type="hidden" name="session" value={session} />
    <label className="text-xs font-semibold">Pitch Type
      <select name="pitch" defaultValue={selectedPitch} onChange={event => event.currentTarget.form?.requestSubmit()} className="mt-1">
        {pitches.map(pitch => <option key={pitch} value={pitch}>{pitch}</option>)}
      </select>
    </label>
    <noscript><button type="submit" className="btn btn-primary mt-2">Show Pitch</button></noscript>
  </Form>;
}
