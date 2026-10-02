import { getPlayerProfileLayout } from "@/lib/player-profile-layout";
import type { PlayerPerformance, PlayerMetricCard } from "@/lib/player-performance";
import type { AthleteSeason } from "@/lib/types";

const BODY_CORE = ["muscle_mass", "body_fat_pct", "body_score"];
export const reportHasPercentile = (card: PlayerMetricCard) => !!card.percentile && card.percentile.sampleSize >= 5;
/** Keep the report's core body measurements before filling the remaining print budget. */
export function reportTestingSelection(performance: PlayerPerformance, season: AthleteSeason | undefined, limit = 10) {
  const layout = getPlayerProfileLayout(performance, season);
  const core = BODY_CORE.flatMap(key => performance.body.filter(card => card.metric.key === key && card.latest));
  const groups = [
    { label: "Physicality", cards: [...layout.physicality, ...core, ...layout.additionalBody.filter(card => !BODY_CORE.includes(card.metric.key))] },
    { label: "Speed & Agility", cards: layout.speedAgility },
    { label: "Hitting", cards: layout.showHitting ? [...layout.hitting, ...layout.otherHitting] : [] },
    { label: "Throwing", cards: [...layout.fieldThrowing, ...layout.pitching] },
  ].map(group => ({ ...group, cards: group.cards.filter(card => card.latest) }));
  const all = groups.flatMap(group => group.cards);
  const priority = [...core, ...layout.physicality.filter(card => card.latest)];
  const remaining = all.filter(card => !priority.includes(card));
  const chosen = new Set([...priority, ...remaining.filter(reportHasPercentile), ...remaining.filter(card => !reportHasPercentile(card))].slice(0, Math.max(priority.length, limit)));
  return { all, chosen, shownGroups: groups.map(group => ({ ...group, cards: group.cards.filter(card => chosen.has(card)) })).filter(group => group.cards.length), hiddenTests: all.length - chosen.size };
}
