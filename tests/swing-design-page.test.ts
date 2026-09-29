import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";
import { blastSource } from "@/lib/blast-metrics";
import type { PlayerPerformance } from "@/lib/player-performance";

const fake = vi.hoisted(() => ({ access: vi.fn(), choices: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), load: vi.fn(), team: vi.fn(), speed: vi.fn(), blueprint: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/render-access", () => ({ requireRenderAccess: fake.access }));
vi.mock("@/lib/staff-athlete-search-server", () => ({ loadStaffAthleteChoices: fake.choices }));
vi.mock("@/lib/performance-server", () => ({ loadAthletePerformance: fake.load }));
vi.mock("@/lib/hitting-team-server", () => ({ loadHittingTeamAverages: fake.team }));
vi.mock("@/lib/blast-speed-percentile-server", () => ({ loadBlastBatSpeedPercentile: fake.speed }));
vi.mock("@/components/hitter-swing-blueprint", () => ({ HitterSwingBlueprint: fake.blueprint }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));

import SwingDesignPage from "@/app/(workspace)/swing-design/page";

const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const athlete: RosterAthlete = {
  id: ownId, athlete_code: "SYN-001", first_name: "Fictional", last_name: "Hitter", preferred_name: null,
  pacific_email: "not-for-display@example.com", profile_photo_url: null, created_at: "", updated_at: "",
  athlete_seasons: [{ athlete_id: ownId, season: "2026-27", jersey_number: 0, primary_position: "OF", secondary_position: null, player_type: "position", bats: "R", throws: "R", academic_class: null, eligibility_year: null, graduation_year: null, roster_status: "active" }],
};
const readings: Measurement[] = [["Blast Swing Count", 50, "count"], ["Average Bat Speed", 65.5, "mph"], ["Attack Angle", 12, "deg"], ["Vertical Bat Angle", -30, "deg"]].map(([metric, value, unit], index) => ({
  id: `fictional-${index}`, athlete_code: athlete.athlete_code, metric: metric as string, value: value as number, unit: unit as string, source: blastSource("average", "2026-09-13", "2026-09-20"), measured_at: "2026-09-20", source_file: "fictional.csv", source_sheet: "CSV", source_row: 2, file_hash: "a".repeat(64),
}));
const reference = { athleteId: ownId, observedValue: 65.5, percentile: 75, sampleSize: 9, swingCount: 50, reportCount: 1, firstDate: "2026-09-13", lastDate: "2026-09-20" };
function access(roles: Role[] = ["player"], athleteId: string | null = ownId, preview = false) {
  return { roles, athleteId, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: roles[0] } : null, supabase: { from: fake.from } };
}
const page = (query?: { athlete?: string | string[] }) => SwingDesignPage({ searchParams: Promise.resolve(query ?? {}) });
beforeEach(() => {
  vi.resetAllMocks();
  fake.access.mockResolvedValue(access());
  const chain = { select: fake.select, eq: fake.eq, maybeSingle: fake.single };
  fake.from.mockReturnValue(chain); fake.select.mockReturnValue(chain); fake.eq.mockReturnValue(chain);
  fake.single.mockResolvedValue({ data: athlete, error: null });
  fake.choices.mockResolvedValue([{ id: ownId, name: "Fictional Hitter", athleteCode: "SYN-001", searchName: "Fictional Hitter" }, { id: otherId, name: "Fictional Teammate", athleteCode: "SYN-002", searchName: "Fictional Teammate" }]);
  fake.load.mockResolvedValue({ measurements: readings, batches: [], percentileOverrides: [] });
  fake.team.mockResolvedValue([]); fake.speed.mockResolvedValue(reference);
  fake.blueprint.mockImplementation(() => createElement("section", { "aria-label": "Practice swing blueprint" }, "Fictional swing design"));
});

describe("Swing Design access and routing", () => {
  it("requires live sign-in before any roster or measurement access", async () => {
    fake.access.mockRejectedValueOnce(new Error("SIGN_IN"));
    await expect(page()).rejects.toThrow("SIGN_IN");
    expect(fake.choices).not.toHaveBeenCalled(); expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled();
  });
  it.each([otherId, [ownId, otherId], "", "LOCAL-001", ownId + "\n"])("rejects invalid or peer selectors before reading data: %j", async id => {
    await expect(page({ athlete: id })).rejects.toThrow("NOT_FOUND");
    expect(fake.choices).not.toHaveBeenCalled(); expect(fake.from).not.toHaveBeenCalled(); expect(fake.team).not.toHaveBeenCalled(); expect(fake.speed).not.toHaveBeenCalled();
  });
  it.each([false, true])("opens the linked player automatically with no peer selector (preview %s)", async preview => {
    const trusted = access(["player"], ownId, preview); fake.access.mockResolvedValueOnce(trusted);
    const html = renderToStaticMarkup(await page());
    expect(fake.choices).not.toHaveBeenCalled();
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId);
    expect(fake.select).toHaveBeenCalledExactlyOnceWith("id,athlete_code,first_name,last_name,preferred_name,athlete_seasons(*)");
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete, { includePercentiles: true });
    expect(fake.team).toHaveBeenCalledExactlyOnceWith(trusted); expect(fake.speed).toHaveBeenCalledExactlyOnceWith(trusted, ownId);
    expect(fake.blueprint.mock.calls[0][0]).toMatchObject({ readings, batSpeedReference: reference, bats: "R" });
    expect(html).toContain("Swing Design"); expect(html).toContain("Fictional Hitter");
    expect(html).not.toContain("Find a Player"); expect(html).not.toContain("Fictional Teammate"); expect(html).not.toContain("not-for-display@example.com");
  });
  it("cannot use the underlying Admin access during Player View", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, true));
    await expect(page({ athlete: otherId })).rejects.toThrow("NOT_FOUND");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.choices).not.toHaveBeenCalled();
  });
  it("gives unlinked players a useful empty state without querying any team data", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Your Player Profile Is Not Linked");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.choices).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.team).not.toHaveBeenCalled();
  });
  it.each([["admin", false], ["coach", false], ["coach", true]] as const)("allows staff selection (%s, preview %s) without loading everyone’s readings", async (role, preview) => {
    const trusted = access([role], null, preview); fake.access.mockResolvedValueOnce(trusted);
    const html = renderToStaticMarkup(await page());
    expect(fake.choices).toHaveBeenCalledExactlyOnceWith(trusted);
    expect(html).toContain("Choose a Hitter"); expect(html).toContain("Fictional Teammate");
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.load).not.toHaveBeenCalled(); expect(fake.team).not.toHaveBeenCalled(); expect(fake.speed).not.toHaveBeenCalled();
  });
  it("loads only the staff-selected athlete", async () => {
    const trusted = access(["coach"], null); fake.access.mockResolvedValueOnce(trusted);
    renderToStaticMarkup(await page({ athlete: ownId }));
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete, { includePercentiles: true });
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId);
  });
  it("rejects missing or mismatched database identities and handles query errors", async () => {
    fake.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(page()).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: { ...athlete, id: otherId }, error: null });
    await expect(page()).rejects.toThrow("NOT_FOUND");
    fake.single.mockResolvedValueOnce({ data: null, error: { message: "fictional error" } });
    await expect(page()).rejects.toThrow("Unable to load");
    expect(fake.load).not.toHaveBeenCalled();
  });
  it("withholds a percentile returned for a different athlete", async () => {
    fake.speed.mockResolvedValueOnce({ ...reference, athleteId: otherId });
    renderToStaticMarkup(await page());
    expect(fake.blueprint.mock.calls[0][0].batSpeedReference).toBeNull();
  });
  it.each([false, true])("uses only the linked player's exact body-rank summaries (Player View %s)", async preview => {
    const trusted = access(["player"], ownId, preview); fake.access.mockResolvedValueOnce(trusted);
    const ownBody: Measurement = { ...readings[0], id: "fictional-body-height", metric: "Height", value: 71, unit: "in", source: "Fictional body testing", measured_at: "2026-09-18", file_hash: "f".repeat(64) };
    fake.load.mockResolvedValueOnce({ measurements: [...readings, ownBody], batches: [], percentileOverrides: [{ athleteCode: athlete.athlete_code, metricKey: "height", measuredAt: ownBody.measured_at, observedValue: 71, unit: "in", source: ownBody.source, period: "fall_2026", direction: "neutral", sampleSize: 8, value: 60 }] });
    renderToStaticMarkup(await page());
    const model = fake.blueprint.mock.calls[0][0].performance as PlayerPerformance;
    expect(model.body.find(card => card.metric.key === "height")).toMatchObject({ latest: { athleteCode: athlete.athlete_code, value: 71, measuredAt: ownBody.measured_at }, percentile: { value: 60, sampleSize: 8, unit: "in", period: "fall_2026", direction: "neutral" } });
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete, { includePercentiles: true });
    expect(fake.choices).not.toHaveBeenCalled();
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId);
  });
  it.each([
    { athleteCode: "SYN-002" }, { measuredAt: "2026-09-17" }, { observedValue: 70 },
    { source: "Different protocol" }, { unit: "cm" }, { sampleSize: 4, value: null },
  ])("does not attach mismatched or unavailable body ranks %j", async patch => {
    const ownBody: Measurement = { ...readings[0], id: "fictional-body-height", metric: "Height", value: 71, unit: "in", source: "Fictional body testing", measured_at: "2026-09-18", file_hash: "f".repeat(64) };
    fake.load.mockResolvedValueOnce({ measurements: [...readings, ownBody], batches: [], percentileOverrides: [{ athleteCode: athlete.athlete_code, metricKey: "height", measuredAt: ownBody.measured_at, observedValue: 71, unit: "in", source: ownBody.source, period: "fall_2026", direction: "neutral", sampleSize: 8, value: 60, ...patch }] });
    renderToStaticMarkup(await page());
    const model = fake.blueprint.mock.calls[0][0].performance as PlayerPerformance;
    expect(model.body.find(card => card.metric.key === "height")?.percentile).toBeNull();
  });
  it("keeps pitcher-only profiles outside hitting measurements", async () => {
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], player_type: "pitcher", primary_position: "P" }] }, error: null });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Built for Hitting Practice"); expect(fake.load).not.toHaveBeenCalled(); expect(fake.team).not.toHaveBeenCalled(); expect(fake.speed).not.toHaveBeenCalled();
  });
  it("allows two-way hitters and renders an honest empty state without Blast averages", async () => {
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], player_type: "two_way", primary_position: "P" }] }, error: null });
    fake.load.mockResolvedValueOnce({ measurements: [], batches: [], percentileOverrides: [] });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Practice Results Coming Soon"); expect(fake.load).toHaveBeenCalledTimes(1); expect(fake.blueprint).not.toHaveBeenCalled();
  });
  it("does not substitute a historical roster season for the Fall cohort", async () => {
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], season: "2025-26" }] }, error: null });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("No Fall Roster Entry"); expect(fake.load).not.toHaveBeenCalled();
  });
});
