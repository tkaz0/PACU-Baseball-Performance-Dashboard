import { GAME_METRIC_LABELS, gameValue, type GameLeaderboardRow } from "@/lib/game-metrics";
import { gameSampleText } from "@/lib/game-opportunities";
import type { TeamGameSummary } from "@/lib/team-game-stats";
import { formatTeamGameMetric } from "@/lib/team-game-stats";

export const ASK_SYSTEM = `Answer a coach's question about the team using only the team data that follows.
Players are identified by PAC code (for example PAC-0012). Always refer to players by their PAC code exactly as written; the dashboard shows names in their place.
Lead with the direct answer, then the supporting numbers. Keep it under about 200 words unless the coach asks for a full list.
When ranking or comparing, say how many players had the stat and note small samples. If the data can't answer the question, say what's missing.`;

export type AskPlayer = { code: string; role: string; position: string; academicClass: string; batsThrows: string };
export type AskTestingBoard = { label: string; context: string; unit: string; rows: { code: string; value: string; rank: number; sample: string | null; date: string }[] };

const EXTRA_LABELS: Record<string, string> = { strike_pct: "Strike %", k: "Strikeouts", innings_outs: "Outs recorded" };
const label = (metric: string) => GAME_METRIC_LABELS[metric] ?? EXTRA_LABELS[metric] ?? metric;

/**
 * One plain-text block for the AI: team totals, then each eligible player's game stats and saved testing results.
 * Identity is limited to PAC codes plus role/position/class/handedness; names and contact details are never included.
 */
export function askData(players: readonly AskPlayer[], gameRows: readonly GameLeaderboardRow[], boards: readonly AskTestingBoard[], team: { batting: TeamGameSummary | null; pitching: TeamGameSummary | null }): string {
  const lines: string[] = ["FALL 2026 TEAM DATA (Pacific Baseball, final)", ""];
  for (const [title, summary] of [["Team hitting (pooled)", team.batting], ["Team pitching (pooled)", team.pitching]] as const) {
    if (!summary) continue;
    const rates = summary.rates.filter(r => !r.pending && r.value !== null).map(r => `${r.label} ${formatTeamGameMetric(r)}`);
    if (rates.length) lines.push(`${title}: ${rates.join(" · ")}`);
  }
  const codes = new Set(players.map(p => p.code));
  const games = new Map<string, GameLeaderboardRow[]>();
  for (const row of gameRows) {
    if (!codes.has(row.code) || !Number.isFinite(row.value)) continue;
    if (row.source === "pitching_fall_2026" && row.eventId !== "fall-2026-cumulative") continue;
    games.set(row.code, [...(games.get(row.code) ?? []), row]);
  }
  const testing = new Map<string, string[]>();
  for (const board of boards) for (const row of board.rows) {
    if (!codes.has(row.code)) continue;
    testing.set(row.code, [...(testing.get(row.code) ?? []), `${board.label} (${board.context}) ${row.value}, rank ${row.rank} of ${board.rows.length}${row.sample ? `, ${row.sample}` : ""}`]);
  }
  lines.push("", "PLAYERS (game stats are cumulative Fall totals; ranks are within the team)");
  for (const p of players) {
    lines.push("", `${p.code} · ${p.role} · ${p.position || "position not recorded"} · ${p.academicClass || "class not recorded"} · ${p.batsThrows || "B/T not recorded"}`);
    const rows = games.get(p.code) ?? [];
    for (const [title, source] of [["Hitting", "qpa_fall_2026"], ["Pitching", "pitching_fall_2026"]] as const) {
      const own = rows.filter(r => r.source === source);
      if (!own.length) continue;
      const sample = own.find(r => r.opportunities != null);
      lines.push(`  ${title}: ${own.map(r => `${label(r.metric)} ${gameValue(r.value, r.unit)} (rank ${r.rank}/${r.sampleSize})`).join(" · ")}${sample ? ` · sample ${gameSampleText(sample.source, sample.metric, sample.opportunities!)}` : ""}`);
    }
    const tests = testing.get(p.code);
    if (tests?.length) lines.push(`  Testing: ${tests.join(" · ")}`);
    if (!rows.length && !tests?.length) lines.push("  No saved Fall results.");
  }
  return lines.join("\n");
}
