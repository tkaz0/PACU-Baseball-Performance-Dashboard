"use client";

import { pitchTypeLabel } from "@/lib/imports/pitch-assignments";

import Form from "next/form";
import { ALL_PITCHES, type LeaderboardSession } from "@/lib/leaderboards";

export function LeaderboardPitchSelector({ pitches, selectedPitch, session }: { pitches: readonly string[]; selectedPitch: string; session: LeaderboardSession }) {
  return <Form action="/leaderboards" scroll={false} className="min-w-0 sm:w-64">
    <input type="hidden" name="group" value="pitching" />
    <input type="hidden" name="session" value={session} />
    <label className="text-xs font-semibold">Pitch Type
      <select name="pitch" defaultValue={selectedPitch} onChange={event => event.currentTarget.form?.requestSubmit()} className="mt-1">
        <option value={ALL_PITCHES}>All Pitches</option>
        {pitches.map(pitch => <option key={pitch} value={pitch}>{pitchTypeLabel(pitch)}</option>)}
      </select>
    </label>
    <noscript><button type="submit" className="btn btn-primary mt-2">Show Rankings</button></noscript>
  </Form>;
}
