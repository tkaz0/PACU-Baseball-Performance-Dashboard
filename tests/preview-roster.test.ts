import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import previewRows from "@/fixtures/preview-roster.json";
import { getPreviewRoster } from "@/lib/preview-roster";
import { parseRosterCsv } from "@/lib/roster/csv";
import { UUID_PATTERN } from "@/lib/types";

describe("public fictional roster source", () => {
  it("matches only the approved ten-row synthetic CSV", () => {
    const csv = readFileSync(new URL("../fixtures/synthetic-roster.csv", import.meta.url), "utf8");
    expect(previewRows).toEqual(parseRosterCsv(csv));
    const roster = getPreviewRoster();
    expect(roster).toHaveLength(10);
    expect(roster.every(a => a.first_name.startsWith("Fictional ") && a.pacific_email?.endsWith("@example.com"))).toBe(true);
    expect(roster.every(a => a.id === a.athlete_code && !UUID_PATTERN.test(a.id))).toBe(true);
  });

  it("preserves jersey zero and missing fields without mutating later requests", () => {
    const roster = getPreviewRoster();
    const first = roster.find(a => a.id === "SYN-001")!;
    expect(first.athlete_seasons[0].jersey_number).toBe(0);
    expect(roster.find(a => a.id === "SYN-010")!.athlete_seasons[0].jersey_number).toBeNull();
    first.athlete_seasons[0].jersey_number = 99;
    expect(getPreviewRoster().find(a => a.id === "SYN-001")!.athlete_seasons[0].jersey_number).toBe(0);
  });
});
