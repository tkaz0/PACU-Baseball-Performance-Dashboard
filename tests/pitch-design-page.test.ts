import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, RosterAthlete } from "@/lib/types";
import type { Measurement } from "@/lib/imports/engine";

const fake = vi.hoisted(() => ({ access: vi.fn(), choices: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), load: vi.fn(), dashboard: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/render-access", () => ({ requireRenderAccess: fake.access }));
vi.mock("@/lib/staff-athlete-search-server", () => ({ loadDesignAthleteChoices: fake.choices }));
vi.mock("@/lib/performance-server", () => ({ loadAthletePerformance: fake.load }));
vi.mock("@/components/pitch-design-dashboard", () => ({ PitchDesignDashboard: fake.dashboard }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));

import PitchDesignPage from "@/app/(workspace)/pitch-design/page";

const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const athlete: RosterAthlete = {
  id: ownId, athlete_code: "SYN-001", first_name: "Fictional", last_name: "Pitcher", preferred_name: null,
  pacific_email: "not-for-display@example.com", profile_photo_url: null, created_at: "", updated_at: "",
  athlete_seasons: [{ athlete_id: ownId, season: "2026-27", jersey_number: 0, primary_position: "P", secondary_position: null, player_type: "pitcher", bats: "R", throws: "L", academic_class: null, eligibility_year: null, graduation_year: null, roster_status: "active" }],
};
const readings: Measurement[] = [{
  id: "fictional-pitch-velocity", athlete_code: athlete.athlete_code, metric: "Average Pitch Velocity", value: 81.5,
  unit: "mph", source: "Full Swing · Practice · Four-Seam Fastball", measured_at: "2026-09-20",
  source_file: "fictional.csv", source_sheet: "CSV", source_row: 2, file_hash: "a".repeat(64),
}];
function access(roles: Role[] = ["player"], athleteId: string | null = ownId, preview = false) {
  return { roles, athleteId, actualRoles: preview ? ["admin"] : roles, preview: preview ? { role: roles[0] } : null, supabase: { from: fake.from } };
}
const page = (query?: { athlete?: string | string[] }) => PitchDesignPage({ searchParams: Promise.resolve(query ?? {}) });
function expectNoPlayerDataReads() {
  expect(fake.choices).not.toHaveBeenCalled();
  expect(fake.from).not.toHaveBeenCalled();
  expect(fake.load).not.toHaveBeenCalled();
  expect(fake.dashboard).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.resetAllMocks();
  fake.access.mockResolvedValue(access());
  const chain = { select: fake.select, eq: fake.eq, maybeSingle: fake.single };
  fake.from.mockReturnValue(chain); fake.select.mockReturnValue(chain); fake.eq.mockReturnValue(chain);
  fake.single.mockResolvedValue({ data: athlete, error: null });
  fake.choices.mockResolvedValue([
    { id: ownId, name: "Fictional Pitcher", athleteCode: "SYN-001", searchName: "Fictional Pitcher" },
    { id: otherId, name: "Fictional Teammate", athleteCode: "SYN-002", searchName: "Fictional Teammate" },
  ]);
  fake.load.mockResolvedValue({ measurements: readings, batches: [], percentileOverrides: [] });
  fake.dashboard.mockImplementation(() => createElement("section", { "aria-label": "Pitch design dashboard" }, "Fictional pitch design"));
});

describe("Pitch Design access and routing", () => {
  it("requires live sign-in before any roster or measurement access", async () => {
    fake.access.mockRejectedValueOnce(new Error("SIGN_IN"));
    await expect(page({ athlete: ownId })).rejects.toThrow("SIGN_IN");
    expectNoPlayerDataReads();
  });

  describe.each([false, true])("effective Player access (View as %s)", preview => {
    beforeEach(() => { fake.access.mockResolvedValue(access(["player"], ownId, preview)); });

    it.each([otherId, [ownId, otherId], "", "LOCAL-001", ownId + "\n"])("rejects peer or malformed selectors before reading data: %j", async id => {
      await expect(page({ athlete: id })).rejects.toThrow("NOT_FOUND");
      expectNoPlayerDataReads();
    });

    it("opens only the linked athlete without showing the staff picker or contact details", async () => {
      const trusted = access(["player"], ownId, preview); fake.access.mockResolvedValueOnce(trusted);
      const html = renderToStaticMarkup(await page());
      expect(fake.choices).not.toHaveBeenCalled();
      expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");
      expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId);
      expect(fake.select).toHaveBeenCalledExactlyOnceWith("id,athlete_code,first_name,last_name,preferred_name,athlete_seasons(*)");
      expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, athlete, { includePercentiles: true });
      expect(fake.dashboard.mock.calls[0][0]).toMatchObject({ readings, throws: "L" });
      expect(html).toContain("Fictional Pitcher");
      expect(html).toContain(`/athletes/${ownId}`);
      expect(html).not.toContain("Find a Player");
      expect(html).not.toContain("Fictional Teammate");
      expect(html).not.toContain("@example.com");
    });
  });

  it("accepts an explicit own-athlete selector with equivalent UUID casing", async () => {
    renderToStaticMarkup(await page({ athlete: ownId.toUpperCase() }));
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", ownId.toUpperCase());
    expect(fake.load).toHaveBeenCalledTimes(1);
    expect(fake.load.mock.calls[0][1].id).toBe(ownId);
    expect(fake.choices).not.toHaveBeenCalled();
  });

  it("gives unlinked players an empty state without querying team data", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Your Player Profile Is Not Linked");
    expect(html).not.toContain("Find a Player");
    expectNoPlayerDataReads();
  });

  it("does not let an unlinked player select an athlete by URL", async () => {
    fake.access.mockResolvedValueOnce(access(["player"], null));
    await expect(page({ athlete: ownId })).rejects.toThrow("NOT_FOUND");
    expectNoPlayerDataReads();
  });

  it.each([["admin", false], ["coach", false], ["coach", true]] as const)("shows staff choices without loading any athlete's readings (%s, View as %s)", async (role, preview) => {
    const trusted = access([role], ownId, preview); fake.access.mockResolvedValueOnce(trusted);
    const html = renderToStaticMarkup(await page());
    expect(fake.choices).toHaveBeenCalledExactlyOnceWith(trusted, "pitch");
    expect(html).toContain("Choose a Pitcher");
    expect(html).toContain("Find a Player");
    // The single searchable picker lists names when opened; the closed state shows the eligible count.
    expect(html).toContain("2 pitchers · choose one");
    expect(html).not.toContain("@example.com");
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.dashboard).not.toHaveBeenCalled();
  });

  it.each([["admin", false], ["coach", false], ["coach", true]] as const)("loads only the selected athlete for staff (%s, View as %s)", async (role, preview) => {
    const trusted = access([role], ownId, preview); fake.access.mockResolvedValueOnce(trusted);
    const selectedAthlete = { ...athlete, id: otherId, athlete_code: "SYN-002", last_name: "Teammate", athlete_seasons: [{ ...athlete.athlete_seasons[0], athlete_id: otherId }] };
    const selectedReadings = readings.map(reading => ({ ...reading, athlete_code: selectedAthlete.athlete_code }));
    fake.single.mockResolvedValueOnce({ data: selectedAthlete, error: null });
    fake.load.mockResolvedValueOnce({ measurements: selectedReadings, batches: [], percentileOverrides: [] });
    const html = renderToStaticMarkup(await page({ athlete: otherId }));
    expect(fake.choices).toHaveBeenCalledExactlyOnceWith(trusted, "pitch");
    expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("id", otherId);
    expect(fake.load).toHaveBeenCalledExactlyOnceWith(trusted, selectedAthlete, { includePercentiles: true });
    expect(fake.dashboard.mock.calls[0][0]).toMatchObject({ readings: selectedReadings, throws: "L" });
    expect(html).toContain("Find a Player");
    expect(html).toContain(`/athletes/${otherId}`);
    expect(html).not.toContain("@example.com");
  });

  it.each([[ownId, otherId], "", "LOCAL-001"])("rejects malformed staff selectors before loading even search choices: %j", async id => {
    fake.access.mockResolvedValueOnce(access(["coach"], null));
    await expect(page({ athlete: id })).rejects.toThrow("NOT_FOUND");
    expectNoPlayerDataReads();
  });

  it.each([
    { data: null, error: null, message: "NOT_FOUND" },
    { data: { ...athlete, id: otherId }, error: null, message: "NOT_FOUND" },
    { data: null, error: { message: "fictional database error" }, message: "Unable to load" },
  ])("does not load measurements after a missing, mismatched, or failed roster result: $message", async result => {
    fake.single.mockResolvedValueOnce({ data: result.data, error: result.error });
    await expect(page()).rejects.toThrow(result.message);
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.dashboard).not.toHaveBeenCalled();
  });

  it("withholds measurement reads for position-only players", async () => {
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], player_type: "position", primary_position: "OF" }] }, error: null });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Built for Pitchers");
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.dashboard).not.toHaveBeenCalled();
  });

  it.each([false, true])("withholds measurements for an unconfirmed role (Player View %s)", async preview => {
    fake.access.mockResolvedValueOnce(access(["player"], ownId, preview));
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], player_type: null, primary_position: null, secondary_position: null }] }, error: null });
    renderToStaticMarkup(await page());
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.dashboard).not.toHaveBeenCalled();
  });
  it("allows explicitly two-way players even when their primary position is not pitcher", async () => {
    const twoWay = { ...athlete, athlete_seasons: [{ ...athlete.athlete_seasons[0], player_type: "two_way", primary_position: "OF" }] };
    fake.single.mockResolvedValueOnce({ data: twoWay, error: null });
    const html = renderToStaticMarkup(await page());
    expect(fake.load).toHaveBeenCalledTimes(1);
    expect(fake.load.mock.calls[0][1]).toBe(twoWay);
    expect(html).toContain("Fictional pitch design");
    expect(html).not.toContain("Built for Pitchers");
  });

  it.each([
    { label: "no seasons", seasons: [] },
    { label: "historical season only", seasons: [{ ...athlete.athlete_seasons[0], season: "2025-26" }] },
  ])("requires an actual 2026–27 roster entry before loading measurements: $label", async ({ seasons }) => {
    fake.single.mockResolvedValueOnce({ data: { ...athlete, athlete_seasons: seasons }, error: null });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("No Fall Roster Entry");
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.dashboard).not.toHaveBeenCalled();
  });
});
