import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireImportAccess: mocks.access }));
import { loadSessionLibrary, parseSessionPublications } from "@/lib/session-library-server";

// Fictional metadata only.
const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reading = (index = 0) => ({ observation_id: `fictional-${index}`, athlete_id: playerId, file_hash: "a".repeat(64), source_file: "fictional-session.csv", source: "Full Swing · Intrasquad", metric_key: "avg_exit_velocity", measured_at: "2026-09-11", imported_at: "2026-09-20T12:00:00Z" });
type Result = { data: unknown[] | null; error: unknown; count: number | null };
const page = (data: unknown[], count = data.length): Result => ({ data, error: null, count });
let responses: Record<string, Result[]>;
let queries: { table: string; select: ReturnType<typeof vi.fn>; or: ReturnType<typeof vi.fn>; gte: ReturnType<typeof vi.fn>; lte: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; range: ReturnType<typeof vi.fn> }[];
beforeEach(() => {
  vi.resetAllMocks(); queries = [];
  responses = { performance_measurements: [page([reading()])], full_swing_contacts: [page([])], athletes: [page([{ id: playerId, athlete_code: "SYN-001", first_name: "Fictional", last_name: "Player", preferred_name: null }])] };
  mocks.from.mockImplementation((table: string) => {
    const query = { table, select: vi.fn(), or: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(), in: vi.fn(), range: vi.fn() };
    [query.select, query.or, query.gte, query.lte, query.order, query.in].forEach(method => method.mockReturnValue(query));
    query.range.mockImplementation(async () => responses[table]?.shift() ?? { data: null, error: true, count: null });
    queries.push(query); return query;
  });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.access.mockResolvedValue({ supabase: { from: mocks.from, rpc: mocks.rpc } });
});

it("denies non-staff or Player View before making any team query", async () => {
  mocks.access.mockRejectedValue(new Error("Access denied"));
  await expect(loadSessionLibrary()).rejects.toThrow("Access denied");
  expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("loads only bounded metadata from ordinary-session RLS tables and the staff publication RPC", async () => {
  expect(await loadSessionLibrary()).toHaveLength(1);
  expect(queries[0].select).toHaveBeenCalledWith("observation_id,athlete_id,file_hash,source_file,source,metric_key,measured_at,imported_at", { count: "exact" });
  expect(queries[1].select).toHaveBeenCalledWith("athlete_id,file_hash,source_file,source_row,category,played_on,imported_at", { count: "exact" });
  expect(queries[0].gte).toHaveBeenCalledWith("measured_at", "2026-09-01");
  expect(queries[0].lte).toHaveBeenCalledWith("measured_at", "2026-12-31");
  expect(queries[2].select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name", { count: "exact" });
  expect(queries[2].in).toHaveBeenCalledWith("id", [playerId]);
  expect(mocks.rpc).toHaveBeenCalledWith("staff_full_swing_session_publications");
});
it("rejects truncation, changing page counts and expanded records rather than claiming no missing results", async () => {
  responses.performance_measurements = [page([reading()], 2)];
  await expect(loadSessionLibrary()).rejects.toThrow("could not be verified");
  responses.performance_measurements = [page([{ ...reading(), value: 80 }])]; responses.full_swing_contacts = [page([])];
  await expect(loadSessionLibrary()).rejects.toThrow("could not be verified");
  responses.performance_measurements = [page(Array.from({ length: 500 }, (_, index) => reading(index)), 501), page([reading(500), reading(501)], 502)]; responses.full_swing_contacts = [page([])];
  await expect(loadSessionLibrary()).rejects.toThrow("could not be verified");
});
it("fails safely if publication metadata cannot be loaded", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "Private provider detail" } });
  await expect(loadSessionLibrary()).rejects.toThrow("Saved sessions could not be verified");
});
it("does not load an unrelated roster when no supported source has saved results", async () => {
  responses.performance_measurements = [page([])];
  expect(await loadSessionLibrary()).toEqual([]);
  expect(mocks.from).not.toHaveBeenCalledWith("athletes");
});
it("validates count-only publication metadata and prior-revision undo limits", () => {
  const publication = { fileHash: "a".repeat(64), fileName: "fictional.csv", date: "2026-09-11", category: "game", mode: "Live at Bat", eventCount: 1, revision: 2, measurementCount: 1, sampleCount: 1, contactCount: 0, assignedCount: 1, unresolvedPitchCount: 0, excludedPlayerCount: 0, removedValueCount: 0, publishedAt: "2026-09-20T12:00:00Z", lastUpdatedAt: "2026-09-21T12:00:00Z", fullyPublished: true, restoreTargetRevision: 1 };
  expect(parseSessionPublications([publication])).toEqual([publication]);
  expect(parseSessionPublications([{ ...publication, fullyPublished: false, restoreTargetRevision: null }])[0].fullyPublished).toBe(false);
  for (const bad of [{ ...publication, eventCount: -1 }, { ...publication, restoreTargetRevision: 2 }, { ...publication, rawRows: [] }, { ...publication, fullyPublished: false }, { ...publication, fullyPublished: "unknown" }, { ...publication, fileHash: "invalid" }]) expect(() => parseSessionPublications([bad])).toThrow("could not be verified");
  expect(() => parseSessionPublications([publication, publication])).toThrow("could not be verified");
});
