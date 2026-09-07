import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdminMutation: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: mocks.requireAdminMutation }));
import { loadRenphoReportCatalog, loadRenphoCorrectionRoster } from "@/lib/renpho-report-catalog-server";

type Page = { data: unknown; error: unknown; count: number | null };
const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const hash = "a".repeat(64);
const row = (index = 0) => ({ file_hash: hash, athlete_id: ownerA, source_file: "fictional-report.png", measured_at: "2026-09-12", metric_key: "weight", source_sheet: "RENPHO report · Page 1", observation_id: `fictional-observation-${String(index).padStart(5, "0")}` });
const person = (id = ownerA, code = "SYN-001") => ({ id, athlete_code: code, first_name: "Fictional", preferred_name: null as string | null, last_name: "Player" });
let responses: Record<string, Page[]>;
let queries: { table: string; select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; like: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; range: ReturnType<typeof vi.fn> }[];
const page = (data: unknown[], count = data.length): Page => ({ data, count, error: null });
beforeEach(() => {
  vi.resetAllMocks();
  responses = { performance_measurements: [page([row()])], athletes: [page([person()])] }; queries = [];
  mocks.from.mockImplementation((table: string) => {
    const query = { table, select: vi.fn(), eq: vi.fn(), like: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() };
    for (const method of [query.select, query.eq, query.like, query.in, query.order]) method.mockReturnValue(query);
    query.range.mockImplementation(async () => responses[table]?.shift() ?? { data: null, count: null, error: true });
    queries.push(query); return query;
  });
  mocks.requireAdminMutation.mockResolvedValue({ supabase: { from: mocks.from } });
});

describe("protected RENPHO report metadata catalog", () => {
  it("requires fresh Admin access outside preview before any query", async () => {
    mocks.requireAdminMutation.mockRejectedValueOnce(new Error("Admin outside preview required"));
    await expect(loadRenphoReportCatalog()).rejects.toThrow("outside preview");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns only report metadata and height presence from minimal exact selections", async () => {
    responses.performance_measurements = [page([row(), { ...row(1), metric_key: "height" }])];
    responses.athletes = [page([{ ...person(), preferred_name: "Sample" }])];
    expect(await loadRenphoReportCatalog()).toEqual([{ fileHash: hash, athleteCode: "SYN-001", athleteName: "Sample Player", sourceFile: "fictional-report.png", measuredAt: "2026-09-12", measurementCount: 2, hasHeight: true }]);
    expect(mocks.requireAdminMutation).toHaveBeenCalledTimes(1);
    expect(queries[0].select).toHaveBeenCalledWith("file_hash,athlete_id,source_file,measured_at,metric_key,observation_id,source_sheet", { count: "exact" });
    expect(queries[0].eq).toHaveBeenCalledWith("source", "RENPHO");
    expect(queries[0].like).toHaveBeenCalledWith("source_sheet", "RENPHO report · Page %");
    expect(queries[0].order).toHaveBeenCalledWith("observation_id", { ascending: true });
    expect(queries[1].select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name", { count: "exact" });
    expect(queries[1].in).toHaveBeenCalledWith("id", [ownerA]);
  });
  it("returns no reports without querying roster when no RENPHO data exists", async () => {
    responses.performance_measurements = [page([])];
    expect(await loadRenphoReportCatalog()).toEqual([]);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("paginates with stable observation ordering and exact counts", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ ...row(i), file_hash: Math.floor(i / 20).toString(16).padStart(64, "0") }));
    responses.performance_measurements = [page(rows.slice(0, 500), 501), page(rows.slice(500), 501)];
    const reports = await loadRenphoReportCatalog();
    expect(reports.reduce((sum, report) => sum + report.measurementCount, 0)).toBe(501);
    expect(queries[0].range).toHaveBeenCalledWith(0, 499);
    expect(queries[1].range).toHaveBeenCalledWith(500, 999);
    expect(queries[1].order).toHaveBeenCalledWith("observation_id", { ascending: true });
  });
  it.each(["athlete_id", "measured_at"] as const)("rejects a report with mixed %s", async field => {
    const other = { ...row(1), [field]: field === "athlete_id" ? ownerB : field === "measured_at" ? "2026-09-13" : "different-fictional-report.png" };
    responses.performance_measurements = [page([row(), other])];
    if (field === "athlete_id") responses.athletes = [page([person(), person(ownerB, "SYN-002")])];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
  it("groups a renamed byte-identical report backfill with its original using a deterministic filename", async () => {
    const original = { ...row(), source_file: "z-fictional-report.png" };
    const backfill = { ...row(1), source_file: "a-fictional-height-backfill.png", metric_key: "height" };
    for (const rows of [[original, backfill], [backfill, original]]) {
      responses.performance_measurements = [page(rows)];
      responses.athletes = [page([person()])];
      expect(await loadRenphoReportCatalog()).toEqual([{ fileHash: hash, athleteCode: "SYN-001", athleteName: "Fictional Player", sourceFile: "a-fictional-height-backfill.png", measuredAt: "2026-09-12", measurementCount: 2, hasHeight: true }]);
    }
  });
  it("rejects duplicated observations instead of double-counting them", async () => {
    responses.performance_measurements = [page([row(), row()])];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
    expect(queries).toHaveLength(1);
  });
  it.each([
    { ...row(), file_hash: "INVALID" }, { ...row(), athlete_id: "INVALID" },
    { ...row(), measured_at: "2026-02-30" }, { ...row(), source_file: "private\nfilename" },
    { ...row(), source_sheet: "Fictional mapped CSV" }, { ...row(), source_sheet: "RENPHO report · Page 0" },
    { ...row(), source_sheet: "RENPHO report · Page Example" }, { ...row(), metric_key: "" }, { ...row(), observation_id: "" }, { ...row(), value: 123 },
  ])("rejects malformed or expanded measurement records", async malformed => {
    responses.performance_measurements = [page([malformed])];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
  it.each([
    { data: [row()], error: { message: "Private provider detail" }, count: 1 },
    { data: [row()], error: null, count: null }, { data: [row()], error: null, count: 2 },
    { data: [], error: null, count: 20001 }, { data: null, error: null, count: 0 },
  ])("rejects unavailable, truncated, and oversized catalog pages without raw errors", async malformed => {
    responses.performance_measurements = [malformed];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("The RENPHO report list could not be verified. Refresh before correcting a report.");
  });
  it("rejects counts that change while pages load", async () => {
    responses.performance_measurements = [page(Array.from({ length: 500 }, (_, i) => row(i)), 501), page([row(500), row(501)], 502)];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
  it.each([
    [], [person(ownerB)], [{ ...person(), email: "fictional@example.com" }], [{ ...person(), preferred_name: "\n" }],
  ].map(data => ({ data })))("rejects absent, unauthorized, or expanded roster records", async ({ data }) => {
    responses.athletes = [page(data)];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
  it("rejects duplicate athlete codes across two report owners", async () => {
    responses.performance_measurements = [page([row(), { ...row(1), athlete_id: ownerB, file_hash: "b".repeat(64) }])];
    responses.athletes = [page([person(), person(ownerB)])];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
  it("rejects report groups beyond the supported correction batch size", async () => {
    responses.performance_measurements = [page(Array.from({ length: 500 }, (_, i) => row(i)), 501), page([row(500)], 501)];
    await expect(loadRenphoReportCatalog()).rejects.toThrow("could not be verified");
  });
});

describe("single report correction destination roster", () => {
  it("includes players without measurements using only minimal Admin roster metadata", async () => {
    responses.athletes = [page([person(), person(ownerB, "SYN-002")])];
    expect(await loadRenphoCorrectionRoster()).toEqual([
      { athleteCode: "SYN-001", athleteName: "Fictional Player" }, { athleteCode: "SYN-002", athleteName: "Fictional Player" },
    ]);
    expect(mocks.requireAdminMutation).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("athletes");
    expect(queries[0].select).toHaveBeenCalledWith("id,athlete_code,first_name,preferred_name,last_name", { count: "exact" });
  });
  it("fails before loading roster when Admin access is denied", async () => {
    mocks.requireAdminMutation.mockRejectedValueOnce(new Error("Preview denied"));
    await expect(loadRenphoCorrectionRoster()).rejects.toThrow("Preview denied");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...person(), id: "invalid" }], [person(), person()], [person(), person(ownerB)],
    [{ ...person(), email: "fictional@example.com" }],
  ].map(data => ({ data })))("rejects malformed, duplicated, or expanded destination data", async ({ data }) => {
    responses.athletes = [page(data)];
    await expect(loadRenphoCorrectionRoster()).rejects.toThrow("could not be verified");
  });
});
