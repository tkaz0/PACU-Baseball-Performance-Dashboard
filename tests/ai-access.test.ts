import { beforeEach, expect, it, vi } from "vitest";
// Fictional identities only.
const fake = vi.hoisted(() => ({ access: vi.fn(), context: vi.fn(), report: vi.fn(), write: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAccess: fake.access }));
vi.mock("@/lib/ask-data-server", () => ({ loadAskContext: fake.context }));
vi.mock("@/lib/exit-meeting-server", () => ({ loadExitMeetingReport: fake.report }));
vi.mock("@/lib/ai-server", async original => ({ ...(await original<typeof import("@/lib/ai-server")>()), writeWithClaude: fake.write }));
import { askTeamData } from "@/app/(workspace)/ask/actions";
import { writePlayerSummary } from "@/app/(workspace)/athletes/[id]/summary-actions";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const access = (roles: string[], preview: unknown = null) => ({ access: { roles, preview, athleteId: roles.includes("player") ? id : null, supabase: {} } });
beforeEach(() => { vi.resetAllMocks(); });

it("refuses Players and Player View before reading any team data or calling the AI", async () => {
  for (const a of [access(["player"]), access(["admin"], { version: 1, actorId: id, role: "player", athleteId: id, expiresAt: Date.now() + 10000 }), { access: null }]) {
    fake.access.mockResolvedValue(a);
    expect(await askTeamData("Who led in OPS?")).toMatchObject({ ok: false });
    expect(await writePlayerSummary(id)).toMatchObject({ ok: false });
  }
  expect(fake.context).not.toHaveBeenCalled(); expect(fake.report).not.toHaveBeenCalled(); expect(fake.write).not.toHaveBeenCalled();
});

it("lets coaches ask and restores names only in the returned answer", async () => {
  fake.access.mockResolvedValue(access(["coach"]));
  fake.context.mockResolvedValue({ data: "PAC-9999 OPS .900", names: new Map([["PAC-9999", "Fictional Boxer"]]), players: 1 });
  fake.write.mockResolvedValue("PAC-9999 led the team in OPS.");
  expect(await askTeamData("  Who led in OPS?  ")).toEqual({ ok: true, answer: "Fictional Boxer led the team in OPS." });
  expect(fake.write.mock.calls[0][0]).toMatchObject({ data: "PAC-9999 OPS .900", request: "Who led in OPS?" });
  expect(await askTeamData("x".repeat(501))).toMatchObject({ ok: false });
  expect(await askTeamData("   ")).toMatchObject({ ok: false, error: "Type a question first." });
});
