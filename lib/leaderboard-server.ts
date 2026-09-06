import "server-only";
import type { requireAccess } from "@/lib/auth";
import { canReadPresentedAthlete } from "@/lib/access-preview";
import { UUID_PATTERN } from "@/lib/types";
import { PLAYER_METRICS, PLAYER_PERFORMANCE_PERIODS, validatePlayerMetricValue } from "@/lib/player-performance";
import type { LeaderboardComparison, LeaderboardRow, LeaderboardSelection } from "@/lib/leaderboards";

type Access = Awaited<ReturnType<typeof requireAccess>>;
const optionFields = ["athleteCount", "metricKey", "period", "source", "unit"].sort().join(",");
const resultFields = ["rank", "athleteCode", "name", "jerseyNumber", "position", "profileId", "value", "measuredAt", "source", "derived"].sort().join(",");
const positions = new Set(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "DH", "UT"]);
const canonicalSource = (source: unknown): source is string => typeof source === "string" && source.length > 0 && source.length <= 100 && !/[\u0000-\u001f\u007f]/.test(source) && source === source.trim().toLowerCase().replace(/\s+/g, " ");
function permitted(access: Access) {
  if (!access.roles.some(role => role === "admin" || role === "coach" || role === "player")) throw new Error("Leaderboard access denied.");
}
function definition(selection: LeaderboardSelection) {
  const metric = PLAYER_METRICS.find(metric => metric.key === selection.metricKey);
  if (!metric || !metric.units.includes(selection.unit) || !canonicalSource(selection.source) ||
    !Object.hasOwn(PLAYER_PERFORMANCE_PERIODS, selection.period) || (selection.period === "summer_2026" && metric.group !== "body")) throw new Error("Choose a valid leaderboard comparison.");
  return metric;
}
export async function loadLeaderboardComparisons(access: Access): Promise<LeaderboardComparison[]> {
  permitted(access);
  const { data, error } = await access.supabase.rpc("team_leaderboard_options");
  if (error || !Array.isArray(data) || data.length > 1000) throw new Error("Leaderboard comparisons could not be loaded.");
  const seen = new Set<string>();
  return data.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).sort().join(",") !== optionFields || !Number.isSafeInteger(item.athleteCount) || item.athleteCount < 1 || item.athleteCount > 1000) throw new Error("Leaderboard comparison format could not be verified.");
    definition(item);
    const key = JSON.stringify([item.metricKey, item.source, item.unit, item.period]);
    if (seen.has(key)) throw new Error("Duplicate leaderboard comparison."); seen.add(key);
    return item as LeaderboardComparison;
  });
}
export async function loadLeaderboard(access: Access, selection: LeaderboardSelection): Promise<LeaderboardRow[]> {
  permitted(access); const metric = definition(selection), period = PLAYER_PERFORMANCE_PERIODS[selection.period];
  const { data, error } = await access.supabase.rpc("team_leaderboard", { p_metric_key: selection.metricKey, p_source: selection.source, p_unit: selection.unit, p_period: selection.period });
  if (error || !Array.isArray(data) || data.length > 1000) throw new Error("The leaderboard could not be loaded.");
  const seen = new Set<string>(); let previous: LeaderboardRow | undefined;
  return data.map((item, index) => {
    const fail = () => { throw new Error("Leaderboard results could not be verified."); };
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).sort().join(",") !== resultFields) return fail();
    if (typeof item.athleteCode !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(item.athleteCode) || seen.has(item.athleteCode) ||
      typeof item.name !== "string" || !item.name.trim() || item.name.length > 201 || /[\u0000-\u001f\u007f]/.test(item.name) ||
      (item.jerseyNumber !== null && (!Number.isSafeInteger(item.jerseyNumber) || item.jerseyNumber < 0 || item.jerseyNumber > 99)) ||
      (item.position !== null && !positions.has(item.position)) || (item.profileId !== null && (typeof item.profileId !== "string" || !UUID_PATTERN.test(item.profileId))) ||
      typeof item.value !== "number" || !validatePlayerMetricValue(metric.key, item.value, selection.unit) || typeof item.derived !== "boolean" || (item.derived && metric.key !== "muscle_mass_pct") ||
      typeof item.measuredAt !== "string" || !/^2026-\d{2}-\d{2}$/.test(item.measuredAt) || !Number.isFinite(Date.parse(item.measuredAt)) || new Date(item.measuredAt).toISOString().slice(0, 10) !== item.measuredAt || item.measuredAt < period.start || item.measuredAt > period.end ||
      item.source !== selection.source || !Number.isSafeInteger(item.rank) || item.rank !== (previous && previous.value === item.value ? previous.rank : index + 1)) return fail();
    if (previous && (metric.direction === "lower" ? item.value < previous.value : item.value > previous.value)) return fail();
    if (previous && item.value === previous.value && item.athleteCode < previous.athleteCode) return fail();
    seen.add(item.athleteCode); previous = item as LeaderboardRow;
    // SQL sees the real Admin during View as. Do not send peer profile links to Player presentation.
    return { ...item, profileId: item.profileId && canReadPresentedAthlete(access, item.profileId) ? item.profileId : null } as LeaderboardRow;
  });
}
