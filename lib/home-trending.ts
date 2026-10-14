import { teamGameSummary } from "@/lib/team-game-stats";
import type { GameWeek } from "@/lib/game-weeks";
import type { WeekPlayer } from "@/lib/home-spotlight";
import { playerGameSources } from "@/lib/coaching-tools";

export type TrendingPlayer = {
  code: string; name: string; profileId: string | null;
  before: number; after: number; change: number;
  beforeSample: string; afterSample: string; tied: boolean;
  /** Every saved week's line for this player (same definitions), oldest first, for a small trend line. */
  history: { week: number; value: number }[];
};
export type TrendingGroup = {
  kind: "hitting" | "pitching"; metric: string; label: string; unit: string;
  beforeLabel: string | null; afterLabel: string | null;
  beforeDetail: string | null; afterDetail: string | null;
  comparable: number; players: TrendingPlayer[];
};

/** Staff presentation only: compare each athlete's two newest consecutive weekly lines.
 * Reuse validated OPS/WHIP definitions, never cumulative-vs-week or practice-vs-game data.
 * Missing, partial and duplicate lines cannot become a zero or an earlier-week fallback.
 */
export function trendingPlayers(players: readonly WeekPlayer[], weeks: { hitting: GameWeek[]; pitching: GameWeek[] }): TrendingGroup[] {
  return (["hitting", "pitching"] as const).map(kind => {
    const hitting = kind === "hitting", source = hitting ? "qpa_fall_2026" : "pitching_fall_2026";
    const metric = hitting ? "batting_ops" : "pitching_whip";
    const ordered = [...weeks[kind]].sort((a, b) => a.week - b.week);
    const after = ordered.at(-1), before = ordered.at(-2);
    const group: TrendingGroup = { kind, metric, label: hitting ? "OPS" : "WHIP", unit: hitting ? "avg" : "decimal",
      beforeLabel: before?.label ?? null, afterLabel: after?.label ?? null,
      beforeDetail: before?.detail ?? null, afterDetail: after?.detail ?? null, comparable: 0, players: [] };
    if (!before || !after || after.week !== before.week + 1 || ordered.some((w, i) => i > 0 && w.week === ordered[i - 1].week)
      || before.source !== source || after.source !== source) return group;
    const eligible = players.filter(p => playerGameSources(p).includes(source));
    // Ambiguous roster codes never pick the first identity.
    const unique = eligible.filter(p => players.filter(other => other.code === p.code).length === 1);
    function line(week: GameWeek, code: string) {
      const rows = week.rows.filter(r => r.athlete_id === code);
      if (!rows.length || rows.some(r => r.source !== source || (hitting ? r.scope !== "cumulative_fall" || r.event_id !== null : r.scope !== "pitching_event" || r.event_id !== `fall-2026-week-${week.week}`))) return null;
      if (rows.some(r => r.unit !== (["qpa_pct", "strike_pct"].includes(r.metric) ? "%" : "count"))) return null;
      const summary = teamGameSummary(rows, source);
      const rate = summary.rates.find(r => r.metric === metric);
      const sample = rows.find(r => r.metric === (hitting ? "pa" : "innings_outs"))?.value;
      if (!rate || rate.pending || rate.value === null || !Number.isFinite(rate.value) || !Number.isSafeInteger(sample) || sample! <= 0) return null;
      return { value: rate.value, sample: hitting ? `${sample} PA` : `${Math.floor(sample! / 3)}.${sample! % 3} IP` };
    }
    const improvements: TrendingPlayer[] = [];
    for (const player of unique) {
      const old = line(before, player.code), current = line(after, player.code);
      if (!old || !current) continue;
      group.comparable++;
      const change = current.value - old.value, gain = hitting ? change : -change;
      if (gain <= 1e-10) continue;
      improvements.push({ code: player.code, name: player.name, profileId: player.profileId,
        before: old.value, after: current.value, change, beforeSample: old.sample, afterSample: current.sample, tied: false,
        history: ordered.flatMap(week => { const l = line(week, player.code); return l ? [{ week: week.week, value: l.value }] : []; }) });
    }
    improvements.sort((a, b) => (hitting ? b.change - a.change : a.change - b.change) || a.name.localeCompare(b.name));
    for (const player of improvements) player.tied = improvements.some(other => other !== player && Math.abs(other.change - player.change) < 1e-10);
    // A short list; equal changes are called out even when a tied player falls beyond the three shown.
    group.players = improvements.slice(0, 3);
    return group;
  });
}
