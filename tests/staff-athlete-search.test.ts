import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchesStaffAthlete, staffAthleteChoice } from "@/lib/staff-athlete-search";
import type { Role, RosterAthlete } from "@/lib/types";

const fake = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), search: vi.fn(), preview: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAccess: fake.access }));
vi.mock("@/app/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("@/components/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/appearance-control", () => ({ AppearanceControl: () => null }));
vi.mock("@/components/access-preview-control", () => ({ AccessPreviewControl: fake.preview }));
vi.mock("@/components/staff-athlete-search", () => ({ StaffAthleteSearch: fake.search }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));
import WorkspaceLayout from "@/app/(workspace)/layout";
import Roster from "@/app/(workspace)/roster/page";
import { RosterTable } from "@/components/roster-table";

const athlete: RosterAthlete = { id: "11111111-1111-4111-8111-111111111111", athlete_code: "PAC-0001", first_name: "Fictional Alexander", preferred_name: "Álex", last_name: "Northstar",
  pacific_email: "private-roster@example.com", profile_photo_url: null, created_at: "", updated_at: "",
  athlete_seasons: [{ athlete_id: "11111111-1111-4111-8111-111111111111", season: "2026-27", jersey_number: 0, primary_position: "CF", secondary_position: "P", player_type: "two_way", bats: "L", throws: "R", academic_class: "junior", eligibility_year: 2, graduation_year: 2028, roster_status: "redshirt" }] };
function access(roles: Role[], preview = false) { return { supabase: { from: fake.from }, roles, actualRoles: preview ? ["admin"] : roles, athleteId: athlete.id,
  user: { email: "fictional-login@example.com" }, preview: preview ? { role: roles[0], athleteId: athlete.id } : null, previewAthleteName: null }; }
beforeEach(() => {
  vi.resetAllMocks();
  const chain = { select: fake.select, eq: fake.eq, order: fake.order, limit: fake.limit };
  for (const method of [fake.from, fake.select, fake.eq, fake.order]) method.mockReturnValue(chain);
  fake.limit.mockResolvedValue({ data: [athlete], error: null });
  fake.access.mockResolvedValue(access(["admin"])); fake.search.mockReturnValue(null); fake.preview.mockReturnValue(null);
});

describe("staff name matching and minimal search projection", () => {
  it.each(["alex", " ALEX NORTH ", "Alexander", "northstar fictional", "PAC-0001"])("finds legal/preferred names and permanent IDs without case or accent sensitivity: %s", query => {
    expect(matchesStaffAthlete(staffAthleteChoice(athlete), query)).toBe(true);
  });
  it.each(["private-roster", "redshirt", "null", "coach", "Northstar Missing"])("does not search private or absent fields: %s", query => {
    expect(matchesStaffAthlete(staffAthleteChoice(athlete), query)).toBe(false);
  });
  it("copies only the exact search fields and keeps permanent identities for duplicate names", () => {
    const projected = staffAthleteChoice(athlete);
    expect(Object.keys(projected).sort()).toEqual(["athleteCode", "id", "name", "searchName"]);
    expect(projected.name).toBe("Álex Northstar"); expect(JSON.stringify(projected)).not.toContain("example.com");
    const second = staffAthleteChoice({ ...athlete, id: "22222222-2222-4222-8222-222222222222", athlete_code: "PAC-0002" });
    expect([projected, second].filter(choice => matchesStaffAthlete(choice, "Northstar")).map(choice => choice.id)).toEqual([athlete.id, second.id]);
  });
});

describe("live staff header and roster search access", () => {
  it("requires access before any search query", async () => {
    fake.access.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(WorkspaceLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
    await expect(Roster({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
    expect(fake.from).not.toHaveBeenCalled();
  });
  it.each([false, true])("does not query or send roster suggestions to a Player (admin preview=%s)", async preview => {
    fake.access.mockResolvedValue(access(["player"], preview));
    renderToStaticMarkup(await WorkspaceLayout({ children: null }));
    expect(fake.from).not.toHaveBeenCalled(); expect(fake.search).not.toHaveBeenCalled();
    if (preview) expect(fake.preview.mock.calls[0][0].athletes).toEqual([]);
    await expect(Roster({ searchParams: Promise.resolve({ q: "Northstar" }) })).rejects.toThrow(`REDIRECT:/athletes/${athlete.id}`);
    expect(fake.from).not.toHaveBeenCalled();
  });
  it.each([{ roles: ["admin"] as Role[], preview: false }, { roles: ["coach"] as Role[], preview: false }, { roles: ["coach"] as Role[], preview: true }])("queries only current roster names with effective $roles (preview=$preview)", async ({ roles, preview }) => {
    fake.access.mockResolvedValue(access(roles, preview));
    renderToStaticMarkup(await WorkspaceLayout({ children: null }));
    expect(fake.from).toHaveBeenCalledExactlyOnceWith("athletes");
    expect(fake.select).toHaveBeenCalledExactlyOnceWith("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons!inner(season)");
    expect(fake.eq).toHaveBeenCalledExactlyOnceWith("athlete_seasons.season", "2026-27");
    expect(fake.search.mock.calls[0][0].athletes).toEqual([staffAthleteChoice(athlete)]);
    if (roles.includes("admin")) expect(fake.preview.mock.calls[0][0].athletes).toEqual([{ id: athlete.id, label: "Álex Northstar" }]);
  });
  it("fails closed when the live search query fails", async () => {
    fake.limit.mockResolvedValue({ data: null, error: { message: "Fictional provider details" } });
    await expect(WorkspaceLayout({ children: null })).rejects.toThrow("Unable to load player search choices");
    expect(fake.search).not.toHaveBeenCalled();
  });
  it("keeps season-scoped suggestions available after applying a search and omits unused private columns", async () => {
    const html = renderToStaticMarkup(await Roster({ searchParams: Promise.resolve({ q: "alex", season: "2026-27" }) }));
    expect(fake.select).toHaveBeenCalledExactlyOnceWith("id,athlete_code,first_name,preferred_name,last_name,athlete_seasons(season,jersey_number,primary_position,academic_class)");
    expect(fake.search.mock.calls[0][0]).toMatchObject({ name: "q", defaultQuery: "alex", athletes: [staffAthleteChoice(athlete)] });
    expect(html).toContain("Álex Northstar"); expect(html).not.toContain("private-roster@example.com");
  });
});

describe("shared roster presentation", () => {
  it("removes Status everywhere without changing jersey zero, roster status, or eligibility data", () => {
    const original = structuredClone(athlete);
    for (const season of [undefined, "2026-27"]) {
      const html = renderToStaticMarkup(createElement(RosterTable, { athletes: [athlete], season }));
      expect(html).not.toContain("Status"); expect(html).not.toContain("redshirt");
      expect(html).toContain('class="font-semibold">0</td>'); expect(html).toContain("CF");
      expect(html).toContain(`/athletes/${athlete.id}`);
    }
    expect(athlete).toEqual(original); expect(athlete.athlete_seasons[0].eligibility_year).toBe(2);
  });
});
