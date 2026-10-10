import type { PitchType } from "@/lib/imports/pitch-assignments";
import { battedBallType } from "@/lib/batted-ball-profile";
import { isLikelyFoul } from "@/lib/likely-foul";

export type AllowedContact = { playedOn: string; category: "game" | "intrasquad" | "practice"; exitVelocity: number; launchAngle: number; direction: number | null; distance: number | null; squaredUp: number | null; potentialExitVelocity?: number | null; pitchType?: PitchType | null };

const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
/** Descriptive summary of batted balls against one pitcher; Likely Foul contact is left out. No hit outcomes are inferred. */
export function contactAllowedSummary(rows: readonly AllowedContact[]) {
  const inPlay = rows.filter(row => !isLikelyFoul(row));
  const squared = inPlay.filter(row => typeof row.squaredUp === "number");
  const share = (test: (row: AllowedContact) => boolean) => inPlay.length ? 100 * inPlay.filter(test).length / inPlay.length : null;
  return {
    count: inPlay.length, fouls: rows.length - inPlay.length, sessions: new Set(inPlay.map(row => row.playedOn)).size,
    avgEv: mean(inPlay.map(row => row.exitVelocity)), maxEv: inPlay.length ? Math.max(...inPlay.map(row => row.exitVelocity)) : null,
    hardHitPct: share(row => row.exitVelocity >= 90), avgLaunch: mean(inPlay.map(row => row.launchAngle)),
    groundPct: share(row => battedBallType(row.launchAngle) === "ground"), linePct: share(row => battedBallType(row.launchAngle) === "line"),
    flyPct: share(row => battedBallType(row.launchAngle) === "fly"), popupPct: share(row => battedBallType(row.launchAngle) === "popup"),
    squaredUp: mean(squared.map(row => row.squaredUp! * 100)), squaredCount: squared.length,
  };
}
