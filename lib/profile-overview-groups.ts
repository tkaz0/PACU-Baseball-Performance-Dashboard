import { isTimedMetric, type PlayerMetricCard } from "@/lib/player-performance";
import { profileSessionContext } from "@/lib/player-profile-layout";

export type ProfileOverviewGroup = {
  id: string;
  title: string;
  context: "In-Game" | "Practice" | "Testing";
  cards: PlayerMetricCard[];
};

/** Display existing authorized cards without combining their sources, units or cohorts. */
export function profileOverviewGroups(cards: readonly PlayerMetricCard[]): ProfileOverviewGroup[] {
  const groups = new Map<string, ProfileOverviewGroup>();
  const seen = new Set<string>();
  for (const card of cards.flatMap(item => item.sourceCards ?? [item])) {
    const reading = card.latest;
    if (!reading || card.metric.group === "body") continue;
    const key = [card.metric.key, reading.source, reading.unit, reading.period].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    const timed = isTimedMetric(card.metric.key);
    const title = timed ? "Athletic Testing" : card.metric.group === "hitting" ? "Hitting" : card.metric.group === "pitching" ? "Pitching" : "Position Throwing";
    const context = timed ? "Testing" : profileSessionContext(reading.source) === "in_game" ? "In-Game" : "Practice";
    const id = `${title.toLowerCase().replaceAll(" ", "-")}-${context.toLowerCase()}`;
    const group = groups.get(id) ?? { id, title, context, cards: [] };
    group.cards.push(card);
    groups.set(id, group);
  }
  const order = ["Hitting:In-Game", "Pitching:In-Game", "Hitting:Practice", "Pitching:Practice", "Position Throwing:Practice", "Athletic Testing:Testing"];
  return [...groups.values()].sort((a, b) => {
    const ai = order.indexOf(`${a.title}:${a.context}`), bi = order.indexOf(`${b.title}:${b.context}`);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.id.localeCompare(b.id);
  });
}
