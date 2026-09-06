import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadLeaderboard, loadLeaderboardComparisons } from "@/lib/leaderboard-server";
import type { LeaderboardRow, LeaderboardSelection } from "@/lib/leaderboards";
const rpc = vi.fn();
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const access = { roles: ["player"], athleteId: id, supabase: { rpc } } as unknown as Parameters<typeof loadLeaderboard>[0];
const selection: LeaderboardSelection = { metricKey: "max_exit_velocity", source: "fictional source", unit: "mph", period: "fall_2026" };
const row = (changes: Partial<LeaderboardRow> = {}): LeaderboardRow => ({ rank: 1, athleteCode: "SYN-001", name: "Fictional Player", jerseyNumber: 0, position: "P", profileId: id, value: 20, measuredAt: "2026-09-12", source: selection.source, derived: false, ...changes });
beforeEach(() => { rpc.mockReset(); });
describe("strict minimal leaderboard response adapter", () => {
  it("uses one exact comparison and returns peer values while stripping forbidden profile IDs", async () => {
    rpc.mockResolvedValue({ data: [row(), row({ rank: 2, athleteCode: "SYN-002", profileId: peerId, value: 10 })], error: null });
    expect((await loadLeaderboard(access, selection)).map(row => row.profileId)).toEqual([id, null]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("team_leaderboard", { p_metric_key: "max_exit_velocity", p_source: "fictional source", p_unit: "mph", p_period: "fall_2026" });
  });
  it("keeps zero values and jersey zero, exact finite decimals and null public identity fields", async () => {
    rpc.mockResolvedValue({ data: [row({ value: 0.30000000000000004 }), row({ rank: 2, athleteCode: "SYN-002", value: 0, profileId: null, jerseyNumber: null, position: null })], error: null });
    const data = await loadLeaderboard(access, selection); expect(data[0].value).toBe(0.30000000000000004); expect(data[0].jerseyNumber).toBe(0); expect(data[1].value).toBe(0);
  });
  it.each([
    [row({ value: NaN })], [row({ value: Infinity })], [row({ value: -1 })], [row({ source: "other source" })], [row({ rank: 2 })],
    [row({ measuredAt: "2026-08-20" })], [row({ measuredAt: "2026-09-31" })], [row({ jerseyNumber: 100 })], [row({ position: "invalid" })], [row({ profileId: "invalid" })],
    [row({ derived: true })], [{ ...row(), email: "fictional@example.com" }], [{ ...row(), source_file: "fictional-report.png" }], [row(), row()],
    [row(), row({ rank: 2, athleteCode: "SYN-002", value: 21 })], [row(), row({ rank: 2, athleteCode: "SYN-002", value: 20 })],
    [row({ athleteCode: "SYN-002" }), row({ athleteCode: "SYN-001" })], null, {}, Array.from({ length: 1001 }, () => row()),
  ])("rejects malformed, leaked, unordered or duplicate result %#", async data => {
    rpc.mockResolvedValue({ data, error: null }); await expect(loadLeaderboard(access, selection)).rejects.toThrow(/leaderboard/i);
  });
  it("accepts stable competition ties and ascending timed values", async () => {
    rpc.mockResolvedValue({ data: [row({ value: 4 }), row({ rank: 1, athleteCode: "SYN-002", value: 4 }), row({ rank: 3, athleteCode: "SYN-003", value: 5 })], error: null });
    expect(await loadLeaderboard(access, { ...selection, metricKey: "home_to_first", unit: "s" })).toHaveLength(3);
  });
  it.each([{ metricKey: "invented" }, { unit: "unknown" }, { period: "summer_2026" }, { source: "Unnormalized Source" }])("rejects invalid selection %# before RPC", async changes => {
    await expect(loadLeaderboard(access, { ...selection, ...changes } as LeaderboardSelection)).rejects.toThrow("valid leaderboard"); expect(rpc).not.toHaveBeenCalled();
  });
  it("denies role-free presented access and does not retry provider errors", async () => {
    await expect(loadLeaderboard({ ...access, roles: [] }, selection)).rejects.toThrow("access denied"); expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: [row()], error: { message: "Fictional failure" } }); await expect(loadLeaderboard(access, selection)).rejects.toThrow("could not be loaded"); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("validates available comparisons with no extra fields or duplicate choices", async () => {
    const option = { ...selection, athleteCount: 1 };
    rpc.mockResolvedValue({ data: [option], error: null }); expect(await loadLeaderboardComparisons(access)).toEqual([option]);
    for (const data of [[{ ...option, source_file: "fictional.png" }], [{ ...option, athleteCount: 0 }], [{ ...option, athleteCount: 1001 }], [option, option], [{ ...option, metricKey: "invalid" }]]) {
      rpc.mockResolvedValue({ data, error: null }); await expect(loadLeaderboardComparisons(access)).rejects.toThrow(/leaderboard/i);
    }
  });
});
