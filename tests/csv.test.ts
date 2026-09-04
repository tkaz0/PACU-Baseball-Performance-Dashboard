import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HEADERS, MAX_BYTES, parseRosterCsv } from "@/lib/roster/csv";
import { display } from "@/lib/types";

const fixture = readFileSync(new URL("../fixtures/synthetic-roster.csv", import.meta.url), "utf8");
describe("strict master-roster CSV", () => {
  it("loads exactly ten explicitly fictional athletes with example.com addresses", () => {
    const rows = parseRosterCsv(fixture);
    expect(rows).toHaveLength(10);
    expect(rows.every(r => r.first_name.startsWith("Fictional ") && r.pacific_email.endsWith("@example.com"))).toBe(true);
  });
  it("preserves jersey zero and leaves missing optional fields blank", () => {
    const rows = parseRosterCsv(fixture);
    expect(rows[0].jersey_number).toBe("0");
    expect(rows[9].jersey_number).toBe("");
    expect(rows[0].profile_photo_url).toBe("");
    expect(display(0)).toBe("0");
  });
  it("accepts BOM/CRLF, quoted commas, and normalizes permanent codes and emails", () => {
    const rows = parseRosterCsv("\uFEFF" + fixture.replaceAll("\n","\r\n").replace("SYN-001"," syn-001 ").replace("synthetic.avery@example.com","SYNTHETIC.AVERY@EXAMPLE.COM").replace("Fictional Avery",'"Fictional, Avery"'));
    expect(rows[0].athlete_code).toBe("SYN-001");
    expect(rows[0].first_name).toBe("Fictional, Avery");
    expect(rows[0].pacific_email).toBe("synthetic.avery@example.com");
  });
  it("rejects extra, reordered, missing, and duplicate headers", () => {
    expect(() => parseRosterCsv(fixture.replace("athlete_code,first_name", "first_name,athlete_code"))).toThrow("template");
    expect(() => parseRosterCsv(fixture.replace("preferred_name", "first_name"))).toThrow("template");
    expect(() => parseRosterCsv(fixture.replace("athlete_code,", ""))).toThrow("template");
    expect(() => parseRosterCsv("extra," + fixture)).toThrow("template");
  });
  it("rejects empty, oversized, overlong, and malformed files", () => {
    expect(() => parseRosterCsv(HEADERS.join(","))).toThrow("1 and 500");
    expect(() => parseRosterCsv("x".repeat(MAX_BYTES+1))).toThrow("1 MiB");
    expect(() => parseRosterCsv(HEADERS.join(",") + "\n" + (fixture.split("\n")[1] + "\n").repeat(501))).toThrow("1 and 500");
    expect(() => parseRosterCsv(fixture.replace("Fictional Avery", '"unterminated'))).toThrow("could not be read");
    expect(() => parseRosterCsv(fixture.replace("SYN-001,", "SYN-001,extra,"))).toThrow("16 cells");
  });
  it("provides exactly the requested public template, with no roster data", () => {
    const template = readFileSync(new URL("../public/templates/master-roster.csv", import.meta.url),"utf8");
    expect(template.trim()).toBe(HEADERS.join(","));
  });
  it("rejects interior empty lines and multiline cells so preview row numbers stay accurate", () => {
    expect(() => parseRosterCsv(fixture.replace("SYN-002", "\nSYN-002"))).toThrow("Row 3");
    expect(() => parseRosterCsv(fixture.replace("Fictional Avery",'"Fictional\nAvery"'))).toThrow("multiline cells");
  });
});
