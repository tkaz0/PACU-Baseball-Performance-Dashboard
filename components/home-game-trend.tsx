import { Sparkline } from "@/components/charts/sparkline";
import { gameDirection } from "@/lib/game-metrics";
import type { TeamGameTrends } from "@/lib/game-trends";
import type { SharedGameStat } from "@/lib/game-server";

/** Optional history streams separately so current results never wait for snapshots. */
export async function HomeGameTrend({ trends, source, metric, label, width=120, height=24 }: {
  trends: Promise<TeamGameTrends>; source: SharedGameStat["source"]; metric: string; label: string; width?: number; height?: number;
}) {
  const points = (await trends)[source]?.[metric];
  return points && points.length > 1 ? <Sparkline points={points} width={width} height={height} label={label} noun="sheet updates" lowerIsBetter={gameDirection(source, metric) === "lower"}/> : null;
}
