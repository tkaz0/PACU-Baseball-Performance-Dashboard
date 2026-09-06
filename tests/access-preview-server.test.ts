import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_PREVIEW_COOKIE, ACCESS_PREVIEW_SECONDS } from "@/lib/access-preview";

const fake = vi.hoisted(() => ({
  raw: undefined as string | undefined,
  actorId: "11111111-1111-4111-8111-111111111111",
  roles: ["admin"] as string[], active: true, authenticated: true, athleteExists: true,
  linked: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as string | null,
  queries: [] as { table: string; columns: string; filters: [string, unknown][] }[],
  rpc: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => fake.raw === undefined ? undefined : { value: fake.raw }, set: fake.setCookie, delete: fake.deleteCookie }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));
vi.mock("@/lib/env", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: fake.authenticated ? { id: fake.actorId, email: "admin@example.com" } : null }, error: null }) },
  rpc: fake.rpc,
  from: (table: string) => {
    const query = { table, columns: "", filters: [] as [string, unknown][] };
    const result = () => {
      fake.queries.push(query);
      const data = table === "app_accounts" ? { is_active: fake.active } : table === "account_roles" ? fake.roles.map(role => ({ role })) : table === "account_athletes" ? fake.linked ? { athlete_id: fake.linked } : null : fake.athleteExists ? { id: query.filters.find(([key]) => key === "id")?.[1], first_name: "Fictional", preferred_name: null, last_name: "Player" } : null;
      return { data, error: null };
    };
    const builder = {
      select(columns: string) { query.columns = columns; return builder; },
      eq(key: string, value: unknown) { query.filters.push([key, value]); return builder; },
      maybeSingle: async () => result(),
      then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
    };
    return builder;
  },
}) }));

import { getAccess, requireAdminMutation, requireAdminWorkspaceAccess, requireImportAccess, requireAccess } from "@/lib/auth";
import { GET } from "@/app/api/athletes/[id]/route";
import { GET as localWorkspaceAccess } from "@/app/api/local-workspace/access/route";
import { startAccessPreview, exitAccessPreview } from "@/app/(workspace)/view-as/actions";
import { configureAccount } from "@/app/(workspace)/admin/access/actions";
import { stageImport, approveImport } from "@/app/(workspace)/admin/import/actions";
import { saveReviewedMeasurements, loadSharedReportMeasurements } from "@/app/(workspace)/imports/actions";
import { importGameSnapshot } from "@/app/(workspace)/imports/game-stats/actions";

const athleteA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const athleteB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function preview(role = "player", athleteId: string | null = athleteA) {
  fake.raw = JSON.stringify({ version: 1, actorId: fake.actorId, role, athleteId, expiresAt: Date.now() + ACCESS_PREVIEW_SECONDS * 1000 - 1000 });
}
beforeEach(() => {
  fake.raw = undefined; fake.roles = ["admin"]; fake.active = true; fake.authenticated = true; fake.athleteExists = true; fake.linked = athleteA; fake.queries = [];
  vi.clearAllMocks();
});

describe("server preview enforcement", () => {
  it("requires live staff for imports while keeping management administrator-only", async () => {
    expect((await requireAdminWorkspaceAccess()).user.id).toBe(fake.actorId);
    const allowed = await localWorkspaceAccess();
    expect(await allowed.json()).toEqual({ allowed: true, userId: fake.actorId, importRole: "admin" });
    expect(allowed.headers.get("Cache-Control")).toContain("no-store");
    fake.roles = ["coach"];
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/access-denied");
    expect((await requireImportAccess()).roles).toEqual(["coach"]);
    expect(await (await localWorkspaceAccess()).json()).toEqual({ allowed: true, userId: fake.actorId, importRole: "coach" });
    for (const roles of [["player"], []]) {
      fake.roles = roles;
      await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/access-denied");
      expect((await localWorkspaceAccess()).status).toBe(403);
    }
    fake.roles = ["admin"]; fake.active = false;
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/access-denied");
    expect((await localWorkspaceAccess()).status).toBe(403);
    fake.active = true; fake.authenticated = false;
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/login");
    expect((await localWorkspaceAccess()).status).toBe(401);
  });
  it("keeps Player view read-only and blocks its browser import workspace", async () => {
    preview();
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/overview?preview=read-only");
    await expect(requireImportAccess()).rejects.toThrow("REDIRECT:/overview?preview=read-only");
    const denied = await localWorkspaceAccess();
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ allowed: false });
  });
  it("opens the browser workspace with effective Coach permissions during a trusted Admin Coach view", async () => {
    preview("coach", null);
    const access = await requireImportAccess();
    expect(access.roles).toEqual(["coach"]); expect(access.actualRoles).toEqual(["admin"]);
    expect(access.user.id).toBe(fake.actorId);
    expect(await (await localWorkspaceAccess()).json()).toEqual({ allowed: true, userId: fake.actorId, importRole: "coach" });
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/overview?preview=read-only");
  });
  it("requires the real Admin to remain active and authorized on every Coach-view import check", async () => {
    preview("coach", null);
    expect((await requireImportAccess()).roles).toEqual(["coach"]);
    fake.roles = ["coach"];
    await expect(requireImportAccess()).rejects.toThrow("REDIRECT:/access-preview-unavailable");
    expect((await localWorkspaceAccess()).status).toBe(403);
    fake.roles = ["admin"]; fake.active = false;
    await expect(requireImportAccess()).rejects.toThrow("REDIRECT:/access-denied");
    fake.active = true; fake.authenticated = false;
    await expect(requireImportAccess()).rejects.toThrow("REDIRECT:/login");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("lets Coach view save reviewed performance rows and read report matches under the real Admin session", async () => {
    preview("coach", null);
    const hash = "a".repeat(64), receipt = { import_id: athleteA, created: 1, unchanged: 0 };
    const measurement = { id: `observation:${JSON.stringify([hash, "Fictional tests", 2, 0])}`, athlete_code: "SYN-001",
      measured_at: "2026-09-12", source: "Fictional testing", metric: "Max EV", value: 10, unit: "mph",
      source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: 2, file_hash: hash };
    fake.rpc.mockResolvedValueOnce({ data: receipt, error: null });
    expect(await saveReviewedMeasurements([measurement], true)).toEqual(receipt);
    expect(fake.rpc.mock.calls[0][0]).toBe("admin_import_performance");
    expect(fake.queries.filter(q => q.table === "app_accounts")).toHaveLength(2);
    expect(fake.queries.filter(q => q.table === "app_accounts").every(q => q.filters[0][1] === fake.actorId)).toBe(true);
    fake.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await loadSharedReportMeasurements(hash)).toEqual({ measurements: [] });
    expect(fake.rpc.mock.calls[1]).toEqual(["performance_report_measurements", { p_file_hash: hash }]);
  });
  it("lets Coach view process a reviewed game snapshot and still refuses all imports in Player view", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
    try {
      preview("coach", null);
      const form = new FormData();
      form.set("snapshot", JSON.stringify({ source: "qpa_fall_2026", contentHash: "a".repeat(64), fetchedAt: "2026-09-13T12:00:00Z",
        observations: [{ athleteCode: "PAC-0001", metric: "pa", value: 0, unit: "count", scope: "cumulative_fall", eventId: null, playedOn: null, sourceRow: 2, sourceColumn: 2, derivedFrom: [] }] }));
      form.set("confirm", "yes");
      fake.rpc.mockResolvedValueOnce({ data: { snapshot_id: athleteA, changed: true, observations: 1 }, error: null });
      await expect(importGameSnapshot(form)).rejects.toThrow(`REDIRECT:/imports/game-stats?saved=${athleteA}`);
      expect(fake.rpc.mock.calls[0][0]).toBe("import_game_snapshot");
      expect(fake.queries.filter(q => q.table === "app_accounts")).toHaveLength(2);
      preview();
      await expect(importGameSnapshot(form)).rejects.toThrow("REDIRECT:/overview?preview=read-only");
      await expect(saveReviewedMeasurements([], true)).rejects.toThrow("REDIRECT:/overview?preview=read-only");
      await expect(loadSharedReportMeasurements("a".repeat(64))).rejects.toThrow("REDIRECT:/overview?preview=read-only");
      expect(fake.rpc).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it("fails closed for a malformed role preview during local workspace checks", async () => {
    fake.raw = "broken";
    await expect(requireAdminWorkspaceAccess()).rejects.toThrow("REDIRECT:/access-preview-unavailable");
    expect((await localWorkspaceAccess()).status).toBe(403);
  });
  it("verifies selected athlete and exposes only effective player roles", async () => {
    preview(); const { access } = await getAccess();
    expect(access?.roles).toEqual(["player"]); expect(access?.actualRoles).toEqual(["admin"]); expect(access?.athleteId).toBe(athleteA);
    expect(fake.queries.filter(q => q.table === "athletes")).toEqual([{ table: "athletes", columns: "id,first_name,preferred_name,last_name", filters: [["id", athleteA]] }]);
  });
  it("rejects a missing player instead of falling back to full admin", async () => {
    preview(); fake.athleteExists = false;
    expect(await getAccess()).toEqual({ access: null, reason: "preview" });
  });
  it("checks account revocation afresh even with a previously valid preview", async () => {
    preview(); expect((await getAccess()).access).not.toBeNull(); fake.active = false;
    expect(await getAccess()).toEqual({ access: null, reason: "forbidden" });
  });
  it("does not accept an authenticated coach's forged preview cookie", async () => {
    preview(); fake.roles = ["coach"];
    expect(await getAccess()).toEqual({ access: null, reason: "preview" });
  });
  it("invalid cookie returns API 403 and protected pages direct to safe exit", async () => {
    fake.raw = "broken";
    expect((await GET(new Request("http://localhost/api/athletes/" + athleteA), { params: Promise.resolve({ id: athleteA }) })).status).toBe(403);
    await expect(requireAccess()).rejects.toThrow("REDIRECT:/access-preview-unavailable");
    expect(fake.queries.some(q => q.table === "athletes")).toBe(false);
  });
  it("denies another athlete through the app API before its row query", async () => {
    preview();
    const response = await GET(new Request("http://localhost/api/athletes/" + athleteB), { params: Promise.resolve({ id: athleteB }) });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Not found" });
    expect(fake.queries.filter(q => q.table === "athletes").every(q => q.filters[0][1] === athleteA)).toBe(true);
  });
  it("allows selected profile API with an explicit ID predicate and no-store", async () => {
    preview();
    const response = await GET(new Request("http://localhost/api/athletes/" + athleteA), { params: Promise.resolve({ id: athleteA }) });
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(fake.queries.filter(q => q.columns.includes("athlete_seasons"))).toEqual([{ table: "athletes", columns: "*, athlete_seasons(*)", filters: [["id", athleteA]] }]);
  });
  it("unlinked real players have no app API row access", async () => {
    fake.roles = ["player"]; fake.linked = null;
    expect((await GET(new Request("http://localhost/api/athletes/" + athleteA), { params: Promise.resolve({ id: athleteA }) })).status).toBe(404);
    expect(fake.queries.some(q => q.table === "athletes")).toBe(false);
  });
  it.each(["coach", "player"])("blocks every roster/account server action during %s preview", async role => {
    preview(role, role === "coach" ? null : athleteA);
    for (const action of [configureAccount, stageImport, approveImport]) await expect(action(new FormData())).rejects.toThrow("REDIRECT:/overview?preview=read-only");
    await expect(requireAdminMutation()).rejects.toThrow("REDIRECT:/overview?preview=read-only");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("only actual active administrators may start preview", async () => {
    const form = new FormData(); form.set("role", "coach"); fake.roles = ["coach"];
    await expect(startAccessPreview(form)).rejects.toThrow("REDIRECT:/access-denied");
    expect(fake.setCookie).not.toHaveBeenCalled();
  });
  it("sets a scoped HttpOnly cookie after verifying exact selected athlete", async () => {
    const form = new FormData(); form.set("role", "player"); form.set("athlete_id", athleteB);
    await expect(startAccessPreview(form)).rejects.toThrow("REDIRECT:/overview");
    const [name, raw, options] = fake.setCookie.mock.calls[0];
    expect(name).toBe(ACCESS_PREVIEW_COOKIE); expect(JSON.parse(raw)).toMatchObject({ actorId: fake.actorId, role: "player", athleteId: athleteB });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("rejects nonexistent or malformed player selections without changing the cookie", async () => {
    for (const id of ["LOCAL-0001", athleteB]) {
      fake.athleteExists = false; const form = new FormData(); form.set("role", "player"); form.set("athlete_id", id);
      await expect(startAccessPreview(form)).rejects.toThrow("REDIRECT:/overview?preview=invalid");
    }
    expect(fake.setCookie).not.toHaveBeenCalled();
  });
  it("exit clears a stale preference after the real account lost admin role", async () => {
    preview(); fake.roles = ["player"];
    await expect(exitAccessPreview()).rejects.toThrow("REDIRECT:/overview");
    expect(fake.deleteCookie).toHaveBeenCalledWith(ACCESS_PREVIEW_COOKIE);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});
