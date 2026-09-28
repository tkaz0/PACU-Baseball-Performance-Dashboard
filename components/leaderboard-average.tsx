import { leaderboardAverage } from "@/lib/leaderboard-average";
import styles from "./leaderboard-average.module.css";
export function LeaderboardAverage({ values, format, label, basis = "result", game = false }: { values: number[]; format: (value: number) => string; label: string; basis?: "result" | "best" | "average"; game?: boolean }) {
  const average = leaderboardAverage(values);
  if (!average) return null;
  const resultType = basis === "best" ? average.count === 1 ? "player best" : "player bests" : basis === "average" ? average.count === 1 ? "player average" : "player averages" : average.count === 1 ? "player result" : "player results";
  const heading = game ? "Average Player" : "Team Average";
  const detail = game ? "Each player's displayed result counts equally. This is the mean player result, not a team rate calculated from pooled opportunities or innings." : basis === "best" ? "Arithmetic mean of the displayed player bests. This does not average individual pitches, swings or trials." : basis === "average" ? "Arithmetic mean of the displayed player averages. Each player counts equally, regardless of their number of swings or pitches." : "Arithmetic mean of the displayed player results. Each player counts once within this exact source, unit and testing period.";
  return <div className={styles.reference} title={detail} aria-label={`${label}: ${heading} ${format(average.mean)} across ${average.count} players. ${detail}`}>
    <div><span>{heading}</span><small>Mean of {average.count} {resultType}</small></div><strong>{format(average.mean)}</strong>
  </div>;
}
