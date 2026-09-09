import "server-only";
import type { requireAccess } from "@/lib/auth";
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import { PHYSICALITY_COMPONENTS, physicalityComposite } from "@/lib/physicality-composite";

export async function loadPhysicalityComposite(access: Awaited<ReturnType<typeof requireAccess>>) {
  const options = (await loadLeaderboardComparisons(access)).filter(o => o.period === "fall_2026" && PHYSICALITY_COMPONENTS.some(k => k === o.metricKey));
  const panels = await Promise.all(options.map(async comparison => ({ comparison, rows: await loadLeaderboard(access, comparison) })));
  return physicalityComposite(panels);
}
