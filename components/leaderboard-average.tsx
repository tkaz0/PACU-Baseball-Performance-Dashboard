import { leaderboardAverage } from "@/lib/leaderboard-average";
import styles from "./leaderboard-average.module.css";
/** Swing-weighted mean when every player has a positive whole swing count; otherwise null. */
function weightedAverage(values: readonly number[], weights?: readonly (number | null | undefined)[]) {
  if (!weights || weights.length !== values.length || !values.length || weights.some(w => !Number.isSafeInteger(w) || (w as number) < 1)) return null;
  const total = (weights as number[]).reduce((sum, w) => sum + w, 0);
  return { mean: values.reduce((sum, v, i) => sum + v * (weights[i] as number), 0) / total, count: values.length, swings: total };
}
export function LeaderboardAverage({ values, format, label, basis = "result", game = false, swingWeights }: { values: number[]; format: (value: number) => string; label: string; basis?: "result" | "best" | "average"; game?: boolean; swingWeights?: readonly (number | null | undefined)[] }) {
  // Blast Fall averages match the profile team average: every swing counts once.
  const weighted = weightedAverage(values, swingWeights);
  if (weighted) {
    const detail = `Every saved swing counts once: player Fall averages weighted by their swing counts (${weighted.swings.toLocaleString("en-US")} swings across ${weighted.count} players). This matches the team average on player profiles.`;
    return <div className={styles.reference} title={detail} aria-label={`${label}: Team Average ${format(weighted.mean)}. ${detail}`}>
      <div><span>Team Average</span><small>{weighted.count} players · {weighted.swings.toLocaleString("en-US")} swings</small></div><strong>{format(weighted.mean)}</strong>
    </div>;
  }
  const average = leaderboardAverage(values);
  if (!average) return null;
  const resultType = basis === "best" ? average.count === 1 ? "player best" : "player bests" : basis === "average" ? average.count === 1 ? "player average" : "player averages" : average.count === 1 ? "player result" : "player results";
  const heading = game ? "Average Player" : "Team Average";
  const detail = game ? "Each player's displayed result counts equally. This is the mean player result, not a team rate calculated from pooled opportunities or innings." : basis === "best" ? "Arithmetic mean of the displayed player bests. This does not average individual pitches, swings or trials." : basis === "average" ? "Arithmetic mean of the displayed player averages. Each player counts equally, regardless of their number of swings or pitches." : "Arithmetic mean of the displayed player results. Each player counts once within this exact source, unit and testing period.";
  return <div className={styles.reference} title={detail} aria-label={`${label}: ${heading} ${format(average.mean)} across ${average.count} players. ${detail}`}>
    <div><span>{heading}</span><small>Mean of {average.count} {resultType}</small></div><strong>{format(average.mean)}</strong>
  </div>;
}
