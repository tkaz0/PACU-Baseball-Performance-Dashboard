import { beforeEach, describe, expect, it, vi } from "vitest";
import { presentedDesignNavigation, seasonDesignNavigation, type DesignSeason } from "@/lib/design-navigation";
import type { Role } from "@/lib/types";

vi.mock("server-only", () => ({}));
import { loadDesignNavigation } from "@/lib/design-navigation-server";

const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", peerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const none = { swing: false, pitch: false }, both = { swing: true, pitch: true };
const season = (patch: Partial<DesignSeason> = {}): DesignSeason => ({ season: "2026-27", player_type: "position", primary_position: "OF", secondary_position: null, ...patch });
const from = vi.fn(), select = vi.fn(), eq = vi.fn(), single = vi.fn();
function access(roles: Role[] = ["player"], athleteId: string | null = ownId, preview = false) {
  return { roles, athleteId, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: "player", athleteId } : null, supabase: { from } } as unknown as Parameters<typeof loadDesignNavigation>[0];
}
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select, eq, maybeSingle: single };
  for (const method of [from, select, eq]) method.mockReturnValue(query);
  single.mockResolvedValue({ data: { athlete_id: ownId, ...season() }, error: null });
});

describe("current-roster design navigation", () => {
  it.each([
    { label: "hitter", patch: {}, expected: { swing: true, pitch: false } },
    { label: "pitcher", patch: { player_type: "pitcher", primary_position: "P" }, expected: { swing: false, pitch: true } },
    { label: "two-way field player", patch: { player_type: "two_way" }, expected: both },
    { label: "two-way pitcher", patch: { player_type: "two_way", primary_position: "P" }, expected: both },
    { label: "recorded pitcher position", patch: { player_type: null, primary_position: "P" }, expected: { swing: false, pitch: true } },
    { label: "secondary pitcher", patch: { secondary_position: "P" }, expected: { swing: false, pitch: true } },
    { label: "recorded secondary field position", patch: { player_type: null, primary_position: null, secondary_position: "ss" }, expected: { swing: true, pitch: false } },
    { label: "normalized two-way", patch: { player_type: " TWO_WAY " }, expected: both },
    { label: "unconfirmed role", patch: { player_type: null, primary_position: null }, expected: none },
    { label: "unfamiliar role and position", patch: { player_type: "unknown", primary_position: "unknown" }, expected: none },
    { label: "historical season", patch: { season: "2025-26" }, expected: none },
  ])("uses the trusted $label without inventing a second discipline", ({ patch, expected }) => {
    expect(seasonDesignNavigation(season(patch))).toEqual(expected);
  });
  it("does not infer a hitter from absent roster information", () => {
    expect(seasonDesignNavigation()).toEqual(none); expect(seasonDesignNavigation(null)).toEqual(none);
  });
  it.each([["admin"], ["coach"], ["coach", "player"]] as Role[][])("keeps both tools for effective staff %s without a linked season", (...roles) => {
    expect(presentedDesignNavigation({ roles, athleteId: null })).toEqual(both);
  });
  it.each([null, "not-a-live-player-id", ownId + "\n"])("withholds player links without a valid linked identity: %s", athleteId => {
    expect(presentedDesignNavigation({ roles: ["player"], athleteId }, season({ player_type: "two_way" }))).toEqual(none);
  });
});

describe("minimal role lookup and Player View isolation", () => {
  it.each([false, true])("reads only the effective linked athlete's current role (Player View %s)", async preview => {
    expect(await loadDesignNavigation(access(["player"], ownId, preview))).toEqual({ swing: true, pitch: false });
    expect(from).toHaveBeenCalledExactlyOnceWith("athlete_seasons");
    expect(select).toHaveBeenCalledExactlyOnceWith("athlete_id,season,player_type,primary_position,secondary_position");
    expect(eq.mock.calls).toEqual([["athlete_id", ownId], ["season", "2026-27"]]);
  });
  it.each([["admin"], ["coach"]] as Role[][])("does not query a roster for effective staff %s", async (...roles) => {
    expect(await loadDesignNavigation(access(roles, null))).toEqual(both); expect(from).not.toHaveBeenCalled();
  });
  it.each([null, "not-a-live-player-id"])("does not query for an unlinked or invalid player: %s", async athleteId => {
    expect(await loadDesignNavigation(access(["player"], athleteId, true))).toEqual(none); expect(from).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: null },
    { data: { athlete_id: peerId, ...season() }, error: null },
    { data: { athlete_id: ownId, ...season({ season: "2025-26" }) }, error: null },
    { data: { athlete_id: ownId, ...season({ player_type: null, primary_position: null }) }, error: null },
    { data: null, error: { message: "Fictional lookup unavailable" } },
  ])("hides design links for a missing, mismatched, stale or failed roster result", async result => {
    single.mockResolvedValueOnce(result);
    expect(await loadDesignNavigation(access())).toEqual(none);
  });
  it("uses fresh effective identity and role inputs after switching Player View", async () => {
    expect(await loadDesignNavigation(access(["player"], ownId, true))).toEqual({ swing: true, pitch: false });
    single.mockResolvedValueOnce({ data: { athlete_id: peerId, ...season({ player_type: "pitcher", primary_position: "P" }) }, error: null });
    expect(await loadDesignNavigation(access(["player"], peerId, true))).toEqual({ swing: false, pitch: true });
    expect(eq.mock.calls).toEqual([["athlete_id", ownId], ["season", "2026-27"], ["athlete_id", peerId], ["season", "2026-27"]]);
  });
});
