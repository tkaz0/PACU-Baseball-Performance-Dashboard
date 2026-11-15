import { afterEach, beforeEach, expect, it, vi } from "vitest";
// Fictional identities and values only.
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic { beta = { messages: { create: sdk.create } }; static APIError = APIError; static RateLimitError = RateLimitError; static AuthenticationError = AuthenticationError; }
  return { default: Anthropic };
});
import { AiError, restoreNames, writeWithClaude, AI_MODEL } from "@/lib/ai-server";
import { summaryData } from "@/lib/ai-summary";
import { askData } from "@/lib/ask-data";
import type { ExitMeetingReport } from "@/lib/exit-meeting";
import type { GameLeaderboardRow } from "@/lib/game-metrics";

const report: ExitMeetingReport = {
  format: "meeting", name: "Fictional Boxer", code: "PAC-9999", jersey: "77", position: "SS", academicClass: "Junior", batsThrows: "R/R",
  season: "Fall 2026", generatedAt: "2026-11-14T12:00:00Z", lastTested: "2026-10-01", lastGameUpdate: "2026-11-02",
  strengths: [{ label: "OPS", detail: ".900 OPS", percentile: 92 }], development: [{ label: "K %", detail: "28.0%", percentile: 15 }], jumps: [],
  sections: [{ id: "hitting", title: "Hitting", subtitle: "Fall 2026 Final", rows: [{ label: "OPS", value: ".900", source: "QPA Fall Sheet", date: "2026-11-02", basis: "Updated snapshot", percentile: 92, peers: 30, sample: "40 PA", trend: [{ date: "2026-09-12", value: 0.8 }, { date: "2026-10-31", value: 0.9 }] }] }],
  missing: ["Home to 1st"], notes: [],
};

beforeEach(() => { sdk.create.mockReset(); process.env.ANTHROPIC_API_KEY = "test-key-not-real"; });
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

it("keeps names, PAC codes and jersey numbers out of the profile summary data", () => {
  const data = summaryData(report);
  expect(data).toContain("OPS: .900 (40 PA), team percentile 92 of 30");
  expect(data).toContain("week by week 0.8 → 0.9");
  expect(data).toContain("Not recorded this Fall: Home to 1st");
  for (const secret of ["Fictional", "Boxer", "PAC-9999", "77"]) expect(data).not.toContain(secret);
});

it("builds Ask the Data context from PAC codes only and restores names on the server", () => {
  const row = (metric: string, value: number, unit: string): GameLeaderboardRow => ({ metric, source: "qpa_fall_2026", eventId: "", playedOn: null, value, unit, rank: 1, name: "Fictional Boxer", code: "PAC-9999", profileId: null, updatedAt: "2026-11-02T00:00:00Z", opportunities: 40, percentile: 90, sampleSize: 30 });
  const data = askData([{ code: "PAC-9999", role: "Position player", position: "SS", academicClass: "Junior", batsThrows: "B R / T R" }], [row("batting_ops", 0.9, "avg")],
    [{ label: "Max Exit Velocity", context: "In-Game", unit: "mph", rows: [{ code: "PAC-9999", value: "95.1 mph", rank: 2, sample: "30 swings", date: "2026-10-01" }] }], { batting: null, pitching: null });
  expect(data).toContain("PAC-9999 · Position player · SS · Junior");
  expect(data).toContain("OPS .900 (rank 1/30)");
  expect(data).toContain("Max Exit Velocity (In-Game) 95.1 mph, rank 2 of 1, 30 swings");
  expect(data).not.toContain("Fictional");
  expect(restoreNames("PAC-9999 led the team; PAC-0001 is unknown.", new Map([["PAC-9999", "Fictional Boxer"]]))).toBe("Fictional Boxer led the team; PAC-0001 is unknown.");
});

it("calls Claude with server-side fallbacks and the cached data block, and reads only text", async () => {
  sdk.create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: "He hit well." }] });
  await expect(writeWithClaude({ system: "Summarize.", data: "DATA", request: "Go" })).resolves.toBe("He hit well.");
  const body = sdk.create.mock.calls[0][0];
  expect(body).toMatchObject({ model: AI_MODEL, fallbacks: "default", betas: ["server-side-fallback-2026-07-01"], messages: [{ role: "user", content: "Go" }] });
  expect(body.system[1]).toEqual({ type: "text", text: "DATA", cache_control: { type: "ephemeral" } });
  expect(body.system[0].text).toContain("Don't give training programs");
});

it("reports a refusal, a missing key or an API failure as a friendly AiError", async () => {
  sdk.create.mockResolvedValue({ stop_reason: "refusal", content: [] });
  await expect(writeWithClaude({ system: "", data: "", request: "x" })).rejects.toThrow(AiError);
  sdk.create.mockRejectedValue(new Error("network"));
  await expect(writeWithClaude({ system: "", data: "", request: "x" })).rejects.toThrow("couldn't be reached");
  delete process.env.ANTHROPIC_API_KEY;
  await expect(writeWithClaude({ system: "", data: "", request: "x" })).rejects.toThrow("isn't set up");
  expect(sdk.create).toHaveBeenCalledTimes(2);
});
