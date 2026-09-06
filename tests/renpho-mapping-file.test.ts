import { describe, expect, it } from "vitest";
import { parseRenphoMappingFile } from "@/lib/renpho-mapping-file";

const roster = ["PAC-0001", "PAC-0002"];
const file = (mappings: unknown) => JSON.stringify({ mappings });
describe("reviewed RENPHO roster file", () => {
  it("preserves leading zeros and multiple historical IDs for one known player", () => {
    expect(parseRenphoMappingFile(file([{ athlete_code: roster[0], renpho_id: " 000123 " }, { athlete_code: roster[0], renpho_id: "fictional-old" }]), roster))
      .toEqual([{ athlete_code: roster[0], renpho_id: "000123" }, { athlete_code: roster[0], renpho_id: "FICTIONAL-OLD" }]);
  });
  it.each([
    [{ athlete_code: "PAC-9999", renpho_id: "FICTIONAL-1" }],
    [{ athlete_code: roster[0], renpho_id: 123 }],
    [{ athlete_code: roster[0], renpho_id: "" }],
    [{ athlete_code: roster[0], renpho_id: "ID WITH SPACE" }],
    [{ athlete_code: roster[0], renpho_id: "FICTIONAL", email: "fixture@example.com" }],
    [{ athlete_code: roster[0], renpho_id: "FICTIONAL" }, { athlete_code: roster[1], renpho_id: "fictional" }],
    [], Array.from({ length: 201 }, (_, i) => ({ athlete_code: roster[0], renpho_id: `FICTIONAL-${i}` })),
  ].map(mappings => ({ mappings })))("rejects unknown players, bad or duplicate IDs and unsupported payloads %#", ({ mappings }) => {
    expect(() => parseRenphoMappingFile(file(mappings), roster)).toThrow();
  });
  it("rejects extra envelope fields and oversized input", () => {
    expect(() => parseRenphoMappingFile('{"mappings":[],"raw_report":"fictional"}', roster)).toThrow();
    expect(() => parseRenphoMappingFile(" ".repeat(65537), roster)).toThrow();
  });
});
