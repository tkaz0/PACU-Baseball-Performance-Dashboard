import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ guard: vi.fn(), access: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: fake.guard, requireAccess: fake.access }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));
vi.mock("@/components/coach-preparation-form", () => ({ CoachPreparationForm: () => createElement("div", {}, "Fictional form boundary") }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));

import { prepareCoach } from "@/app/(workspace)/admin/rollout/actions";
import RolloutPage from "@/app/(workspace)/admin/rollout/page";

const candidateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const playerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function form() {
  const value = new FormData(); value.set("display_name", " Fictional Coach "); value.set("email", " COACH@EXAMPLE.COM "); value.set("confirm", "yes"); return value;
}
beforeEach(() => {
  vi.resetAllMocks();
  fake.guard.mockResolvedValue({ supabase: { rpc: fake.rpc } });
  fake.access.mockResolvedValue({ supabase: { from: fake.from } });
  fake.rpc.mockResolvedValue({ data: candidateId, error: null });
});

describe("coach preparation server action", () => {
  it("uses the normal guarded RPC for reviewed fields only, without provisioning or invitation calls", async () => {
    const input = form(); input.set("role", "admin"); input.set("user_id", candidateId);
    await expect(prepareCoach(input)).rejects.toThrow("REDIRECT:/admin/rollout?saved=1");
    expect(fake.guard).toHaveBeenCalledExactlyOnceWith();
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("admin_prepare_coach", { p_display_name: "Fictional Coach", p_email: "coach@example.com", p_reviewed: true });
    expect(fake.revalidate).toHaveBeenCalledExactlyOnceWith("/admin/rollout");
  });
  it.each(["/login", "/access-denied", "/overview?preview=read-only"])("rejects before any RPC when the access guard denies %s", async destination => {
    fake.guard.mockRejectedValueOnce(new Error(`REDIRECT:${destination}`));
    await expect(prepareCoach(form())).rejects.toThrow(`REDIRECT:${destination}`);
    expect(fake.rpc).not.toHaveBeenCalled(); expect(fake.revalidate).not.toHaveBeenCalled();
  });
  it.each(["display_name", "email", "confirm"])("rejects absent, duplicate and non-string %s fields before RPC", async field => {
    const missing = form(); missing.delete(field);
    const duplicate = form(); duplicate.append(field, "duplicate");
    const file = form(); file.set(field, new File(["fictional"], "fictional.txt"));
    for (const input of [missing, duplicate, file]) await expect(prepareCoach(input)).rejects.toThrow("REDIRECT:/admin/rollout?error=input");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([["display_name", ""], ["display_name", "x".repeat(161)], ["display_name", "Fictional\nCoach"], ["email", "invalid"], ["email", "coach@example.com\n"], ["confirm", "no"]])("rejects invalid %s before RPC", async (field, value) => {
    const input = form(); input.set(field, value);
    await expect(prepareCoach(input)).rejects.toThrow("REDIRECT:/admin/rollout?error=input");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("does not claim success on provider errors or an unverified RPC result", async () => {
    for (const response of [{ data: null, error: { message: "fictional error" } }, { data: null, error: null }, { data: "bad-id", error: null }]) {
      fake.rpc.mockResolvedValueOnce(response);
      await expect(prepareCoach(form())).rejects.toThrow("REDIRECT:/admin/rollout?error=save");
    }
    expect(fake.revalidate).not.toHaveBeenCalled();
  });
});

function query(data: unknown[], count = data.length, error: unknown = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain); chain.limit.mockResolvedValue({ data, count, error });
  return chain;
}
const player = (overrides = {}) => ({ id: playerId, athlete_code: "SYN-NEW", first_name: "Fictional", preferred_name: null, last_name: "Current Player", pacific_email: "player@example.com", athlete_seasons: [{ season: "2026-27", roster_status: null }], ...overrides });
describe("admin-only rollout page", () => {
  it("requires admin presentation before reading any list", async () => {
    fake.access.mockRejectedValueOnce(new Error("REDIRECT:/overview?preview=read-only"));
    await expect(RolloutPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/overview?preview=read-only");
    expect(fake.access).toHaveBeenCalledExactlyOnceWith(["admin"]); expect(fake.from).not.toHaveBeenCalled();
  });
  it("scopes to current roster, excludes old fictional season entries and shows saved coaches as preparation only", async () => {
    const roster = query([player(), player({ id: candidateId, first_name: "Oldfixture", athlete_seasons: [{ season: "2026", roster_status: null }] })]);
    fake.from.mockReturnValueOnce(roster).mockReturnValueOnce(query([])).mockReturnValueOnce(query([{ id: candidateId, display_name: "Fictional Coach", email: "coach@example.com", created_at: "2026-09-06T00:00:00Z" }]));
    const html = renderToStaticMarkup(await RolloutPage({ searchParams: Promise.resolve({ saved: "1" }) }));
    expect(roster.select.mock.calls[0][0]).toContain("athlete_seasons!inner");
    expect(roster.eq).toHaveBeenCalledExactlyOnceWith("athlete_seasons.season", "2026-27");
    expect(html).toContain("Fictional Current Player"); expect(html).not.toContain("Oldfixture");
    expect(html).toContain("Ready to invite"); expect(html).toContain("Fictional Coach");
    expect(html).toContain("Coach details saved. Invitation not sent."); expect(html).toContain('href="/admin/access"');
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("distinguishes connected, disabled-linked, missing-email and inactive-roster rows", async () => {
    const secondId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const thirdId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const fourthId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    fake.from.mockReturnValueOnce(query([player(), player({ id: secondId }), player({ id: thirdId, pacific_email: null }), player({ id: fourthId, athlete_seasons: [{ season: "2026-27", roster_status: "inactive" }] })]))
      .mockReturnValueOnce(query([{ user_id: "fictional-1", is_active: true, account_roles: [{ role: "player" }], account_athletes: { athlete_id: playerId } },
        { user_id: "fictional-2", is_active: false, account_roles: [{ role: "player" }], account_athletes: [{ athlete_id: secondId }] }])).mockReturnValueOnce(query([]));
    const html = renderToStaticMarkup(await RolloutPage({ searchParams: Promise.resolve({}) }));
    for (const status of ["Account connected", "Account needs review", "Email needed", "Roster needs review"]) expect(html).toContain(status);
  });
  it("does not present an incomplete or failed list as an empty successful rollout", async () => {
    for (const roster of [query([], 1001), query([], 0, { message: "fictional error" })]) {
      fake.from.mockReturnValueOnce(roster).mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
      await expect(RolloutPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
    }
  });
});
