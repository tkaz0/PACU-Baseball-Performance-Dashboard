import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), load: vi.fn(), charts: vi.fn(), games: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAccess: fake.access }));
vi.mock("@/lib/performance-server", () => ({ loadAthletePerformance: fake.load }));
vi.mock("@/lib/game-server", () => ({ loadGameStats: fake.games }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
vi.mock("@/components/renpho-charts", () => ({ RenphoCharts: fake.charts }));

import Profile from "@/app/(workspace)/athletes/[id]/page";

const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const athlete: RosterAthlete = {
  id: ownId, athlete_code: "SYN-001", first_name: "Fictional", last_name: "Profile", preferred_name: null,
  pacific_email: "private-roster@example.com", profile_photo_url: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  athlete_seasons: [{ athlete_id: ownId, season: "2026-27", jersey_number: 0, primary_position: "OF", secondary_position: null, player_type: "two_way",
    bats: "R", throws: "R", academic_class: "graduate", eligibility_year: 4, graduation_year: 2027, roster_status: "redshirt" }],
};
const reading = (change: Partial<Measurement> = {}): Measurement => ({
  id: "fictional-reading", athlete_code: athlete.athlete_code, measured_at: "2026-09-12", source: "Fictional hitting test", metric: "Max EV",
  value: 10, unit: "mph", source_file: "fictional.csv", source_sheet: "Values", source_row: 2, file_hash: "a".repeat(64), ...change,
});
function access(roles: Role[] = ["player"], athleteId: string | null = ownId, preview = false) {
  return { roles, athleteId, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: roles[0], athleteId: roles[0] === "player" ? ownId : null } : null,
    user: { id: "fictional-user", email: "private-login@example.com" }, supabase: { from: fake.from } };
}
beforeEach(() => {
  vi.resetAllMocks();
  const chain = { select: fake.select, eq: fake.eq, maybeSingle: fake.single };
  fake.from.mockReturnValue(chain); fake.select.mockReturnValue(chain); fake.eq.mockReturnValue(chain);
  fake.single.mockResolvedValue({ data: athlete, error: null });
  fake.access.mockResolvedValue(access());
  fake.load.mockResolvedValue({ measurements: [reading()], batches: [], percentileOverrides: [] });
  fake.games.mockResolvedValue([]);
  fake.charts.mockImplementation(() => createElement("p", null, "Fictional chart boundary"));
});

describe("protected profile route authorization and integration", () => {
  it("requires authentication before querying any profile or performance data", async () => {
    fake.access.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("REDIRECT:/login");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled();
  });
  it.each([otherId, "LOCAL-0001", "", "../../admin/access", ownId + "\n"])("rejects malformed or another player's ID %# before the profile query", async id => {
    await expect(Profile({ params: Promise.resolve({ id }) })).rejects.toThrow("NOT_FOUND");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled();
  });
  it("does not fall back to actual admin authority during a player preview", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, true));
    await expect(Profile({ params: Promise.resolve({ id: otherId }) })).rejects.toThrow("NOT_FOUND");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled();
  });
  it("denies unlinked players and missing/error profile results without loading measurements", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: null, error: { message: "fictional query failure" } });
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("Unable to load this athlete profile");
    expect(fake.load).not.toHaveBeenCalled(); expect(fake.games).not.toHaveBeenCalled();
  });
  it("queries the requested athlete and loads only its explicitly authorized performance input", async () => {
    const trusted = access(); fake.access.mockResolvedValueOnce(trusted);
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId.toUpperCase() }) }));
    expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId.toUpperCase());
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete);
    expect(fake.games).not.toHaveBeenCalled();
    expect(html).toContain("Fictional Profile"); expect(html).toContain('data-metric-key="max_exit_velocity"');
    expect(html).toContain('data-value="10"'); expect(html).toContain("Jersey Number");
  });
  it.each([false, true])("omits administrative controls, roster email and account metadata from rendered player view (preview=%s)", async preview => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, preview));
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    for (const hidden of ["private-roster@example.com", "private-login@example.com", "Administrative roster details", "Roster email", "Academic class", "graduate", "redshirt", "Permanent athlete code", "/admin/performance", "/imports", "Team roster"]) expect(html).not.toContain(hidden);
    expect(html).toContain("Measurement history");
    expect(html).not.toContain('data-testid="player-percentile"');
  });
  it("preserves read-only notices after the compatibility redirect without giving the preview import controls", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, true));
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }), searchParams: Promise.resolve({ preview: "read-only" }) }));
    expect(html).toContain("This action is unavailable in the selected view. No change was saved.");
    expect(html).not.toContain('href="/imports"');
    expect(fake.games).not.toHaveBeenCalled();
  });
  it("shows imports to actual staff and Coach view, and limits management details to presented admin", async () => {
    fake.access.mockResolvedValueOnce(access(["coach"], null));
    const coach = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(coach).toContain("Team roster"); expect(coach).not.toContain("Administrative roster details"); expect(coach).not.toContain("private-roster@example.com"); expect(coach).toContain('href="/imports"');
    fake.access.mockResolvedValueOnce(access(["coach"], null, true));
    const preview = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(preview).toContain('href="/imports"');
    fake.access.mockResolvedValueOnce(access(["admin"], null));
    const admin = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(admin).toContain("Administrative roster details"); expect(admin).toContain("private-roster@example.com"); expect(admin).toContain('href="/imports"');
  });
  it("uses own aggregate overlays without peer rows and keeps baseball outside Fall out of history", async () => {
    fake.load.mockResolvedValueOnce({ measurements: [reading(), reading({ id: "fictional-summer", measured_at: "2026-08-12", metric: "Summer-only metric" }), reading({ id: "fictional-old", measured_at: "2025-09-12", metric: "Old-only metric" })], batches: [], percentileOverrides: [{
      athleteCode: athlete.athlete_code, metricKey: "max_exit_velocity", measuredAt: "2026-09-12", observedValue: 10, value: 50, sampleSize: 5,
      period: "fall_2026", unit: "mph", source: "Fictional hitting test", direction: "higher",
    }] });
    const html = renderToStaticMarkup(await Profile({ params: Promise.resolve({ id: ownId }) }));
    expect(html).toContain("Pacific n=5"); expect(html).toContain('data-percentile="50"');
    expect(html).not.toContain("Summer-only metric"); expect(html).not.toContain("Old-only metric");
    expect(fake.load).toHaveBeenCalledTimes(1);
  });
  it("hides pitcher speed tests from cards and history without changing saved input", async () => {
    const pitcher = {...athlete, athlete_seasons: athlete.athlete_seasons.map(s => ({...s, player_type: "pitcher", primary_position: "P"}))};
    fake.single.mockResolvedValueOnce({data: pitcher, error: null});
    const measurements = [reading({metric: "Home to First", value: 4.2, unit: "s"}), reading({id: "fictional-weight", metric: "Weight", value: 180, unit: "lb"})];
    fake.load.mockResolvedValueOnce({measurements, batches: [], percentileOverrides: []});
    const html = renderToStaticMarkup(await Profile({params: Promise.resolve({id: ownId})}));
    expect(html).not.toContain("Home to First"); expect(html).not.toContain("Speed &amp; Agility");
    expect(html).toContain("Measurement history · 1 readings"); expect(html).toContain('data-value="180"');
    expect(measurements).toHaveLength(2);
  });
  it("does not present a failed performance load as a successful empty profile", async () => {
    fake.load.mockRejectedValueOnce(new Error("Fictional performance unavailable"));
    await expect(Profile({ params: Promise.resolve({ id: ownId }) })).rejects.toThrow("Fictional performance unavailable");
    expect(fake.charts).not.toHaveBeenCalled();
  });
});
