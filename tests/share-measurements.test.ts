import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@/lib/imports/engine";

const fake = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: fake.guard }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidate }));

import { shareMeasurements } from "@/app/(workspace)/admin/performance/actions";

// Fictional observations only. The real validation/adapter runs against a mocked user-session RPC.
const importId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileHash = "a".repeat(64);
const measurement = (change: Partial<Measurement> = {}): Measurement => ({
  id: `observation:${JSON.stringify([fileHash, "Fictional tests", 2, 0])}`, athlete_code: "SYN-001",
  measured_at: "2026-09-12", source: "Fictional testing", metric: "Max EV", value: 10, unit: "mph",
  source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: 2, file_hash: fileHash, ...change,
});
function form(value: unknown = [measurement()]) {
  const data = new FormData(); data.set("measurements", JSON.stringify(value)); data.set("confirm", "yes"); return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  fake.guard.mockResolvedValue({ supabase: { rpc: fake.rpc } });
  fake.rpc.mockResolvedValue({ data: { import_id: importId, created: 1, unchanged: 0 }, error: null });
});

describe("shared measurement action authorization and receipt", () => {
  it.each(["/login", "/access-denied", "/overview?preview=read-only"])("stops before reading payload fields when the guard denies %s", async path => {
    const data = form(); const fields = vi.spyOn(data, "getAll");
    fake.guard.mockRejectedValueOnce(new Error(`REDIRECT:${path}`));
    await expect(shareMeasurements(data)).rejects.toThrow(`REDIRECT:${path}`);
    expect(fields).not.toHaveBeenCalled(); expect(fake.rpc).not.toHaveBeenCalled(); expect(fake.revalidate).not.toHaveBeenCalled();
  });
  it("rechecks authorization before RPC so revocation during validation cannot save", async () => {
    fake.guard.mockResolvedValueOnce({ supabase: { rpc: fake.rpc } }).mockRejectedValueOnce(new Error("Fictional revoked administrator"));
    await expect(shareMeasurements(form())).rejects.toThrow("REDIRECT:/admin/performance?error=save");
    expect(fake.guard).toHaveBeenCalledTimes(2); expect(fake.rpc).not.toHaveBeenCalled(); expect(fake.revalidate).not.toHaveBeenCalled();
  });
  it("uses only canonical measurement columns in the normal RPC, then fixed receipt navigation and revalidation", async () => {
    const data = form([{ ...measurement(), private_note: "fictional omitted field", email: "unused@example.com", role: "admin" }]);
    data.set("next", "https://outside.example.com");
    await expect(shareMeasurements(data)).rejects.toThrow(`REDIRECT:/admin/performance?import=${importId}`);
    expect(fake.guard).toHaveBeenCalledTimes(2);
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("admin_import_performance", { p_rows: [{
      observation_id: measurement().id, athlete_code: "SYN-001", metric_key: "max_exit_velocity", measured_at: "2026-09-12",
      value: 10, unit: "mph", source: "Fictional testing", source_file: "fictional.csv", source_sheet: "Fictional tests", source_row: 2, file_hash: fileHash,
    }] });
    expect(fake.revalidate.mock.calls).toEqual([["/overview"], ["/athletes", "layout"]]);
  });
  it("accepts an unchanged-only verified receipt without falsely creating another observation", async () => {
    fake.rpc.mockResolvedValueOnce({ data: { import_id: importId, created: 0, unchanged: 1 }, error: null });
    await expect(shareMeasurements(form())).rejects.toThrow(`REDIRECT:/admin/performance?import=${importId}`);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not claim success or retry after an uncertain provider failure", async () => {
    fake.rpc.mockRejectedValueOnce(new Error("Fictional connection failed after submission"));
    await expect(shareMeasurements(form())).rejects.toThrow("REDIRECT:/admin/performance?error=save");
    expect(fake.rpc).toHaveBeenCalledTimes(1); expect(fake.revalidate).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "Fictional rejection" } },
    { data: { import_id: "https://outside.example.com", created: 1, unchanged: 0 }, error: null },
    { data: { import_id: importId, created: 2, unchanged: 0 }, error: null },
    { data: { import_id: importId, created: -1, unchanged: 2 }, error: null },
  ])("rejects an errored or unverified receipt %# before success navigation", async response => {
    fake.rpc.mockResolvedValueOnce(response);
    await expect(shareMeasurements(form())).rejects.toThrow("REDIRECT:/admin/performance?error=save");
    expect(fake.revalidate).not.toHaveBeenCalled();
  });
});

describe("shared measurement action payload boundaries", () => {
  it.each(["measurements", "confirm"])("requires exactly one string %s field", async name => {
    const missing = form(); missing.delete(name);
    const duplicate = form(); duplicate.append(name, "duplicate");
    const file = form(); file.set(name, new File(["fictional"], "fictional.txt"));
    for (const data of [missing, duplicate, file]) await expect(shareMeasurements(data)).rejects.toThrow("REDIRECT:/admin/performance?error=review");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(["", "no", "true", "YES"])("does not accept unchecked or substituted confirmation %s", async value => {
    const data = form(); data.set("confirm", value);
    await expect(shareMeasurements(data)).rejects.toThrow("REDIRECT:/admin/performance?error=review");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(["x".repeat(1048577), "é".repeat(524289)])("rejects payloads over 1 MiB measured as bytes %#", async text => {
    const data = form(); data.set("measurements", text);
    await expect(shareMeasurements(data)).rejects.toThrow("REDIRECT:/admin/performance?error=review");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {}, "fictional", 1, [], [null], Array.from({ length: 501 }, () => measurement())])("rejects non-array, empty or oversized row collections %#", async value => {
    await expect(shareMeasurements(form(value))).rejects.toThrow("REDIRECT:/admin/performance?error=input");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and duplicate observation coordinates", async () => {
    const invalid = form(); invalid.set("measurements", "{invalid}");
    for (const data of [invalid, form([measurement(), measurement()])]) await expect(shareMeasurements(data)).rejects.toThrow("REDIRECT:/admin/performance?error=input");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { source: "" }, { source: "Fictional\nsource" }, { source_file: "" }, { source_row: 0 },
    { source_sheet: "Different source coordinates" }, { file_hash: "bad-hash" }, { measured_at: "2026-09-31" },
    { metric: "Unmapped metric" }, { unit: "unknown" }, { value: -1 },
  ])("rejects a bad extra observation %# before any partial save", async changes => {
    const second = measurement({ id: `observation:${JSON.stringify([fileHash, "Fictional tests", 3, 0])}`, source_row: 3, ...changes });
    await expect(shareMeasurements(form([measurement(), second]))).rejects.toThrow("REDIRECT:/admin/performance?error=input");
    expect(fake.rpc).not.toHaveBeenCalled(); expect(fake.revalidate).not.toHaveBeenCalled();
  });
});
