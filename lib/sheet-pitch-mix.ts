import type { SharedGameStat } from "@/lib/game-server";
import { cumulativePitching } from "@/lib/pitching-cumulative";
import { pitchSplits, sheetPitchMix, type SheetPitchMix } from "@/lib/pitching-stats";

/** One player's cumulative Fall game-sheet pitch mix, or null when the sheet has no complete counts. */
export function playerSheetPitchMix(stats: readonly SharedGameStat[]): SheetPitchMix | null {
  const cumulative = cumulativePitching(stats);
  const total = cumulative.find(r => r.metric === "pitches")?.value ?? null;
  return sheetPitchMix(pitchSplits(cumulative), total);
}
