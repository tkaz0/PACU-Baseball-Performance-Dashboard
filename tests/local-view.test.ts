import { describe, expect, it } from "vitest";
import { adminView, localViewAllowsPath, parseLocalView, projectLocalView, type LocalView } from "@/lib/local-view";
import { getPreviewRoster } from "@/lib/preview-roster";
import type { StoredMeasurement } from "@/lib/local-workspace";

const roster = getPreviewRoster().filter(a => ["SYN-001", "SYN-002"].includes(a.athlete_code));
const readings: StoredMeasurement[] = ["SYN-001", "SYN-002", "SYN-001-OTHER"].map((code, index) => ({
  id: `fictional-view-reading-${index}`, athlete_code: code, measured_at: "2026-01-01", source: "Fictional test",
  metric: "Fictional reading", value: index, unit: "s", source_file: "fictional-view.csv", source_sheet: "CSV",
  source_row: index + 2, file_hash: "a".repeat(64), batch_id: "fictional-view-batch",
}));
const coach: LocalView = { role: "coach", athleteCode: null };
const player: LocalView = { role: "player", athleteCode: "SYN-001" };

describe("browser-local display preference parsing", () => {
  it("defaults missing or malformed preferences without changing saved workspace data", () => {
    for (const raw of [null, "", "{broken", "null", "[]", "42", '{"role":"unknown"}', '{"role":"admin","athleteCode":"SYN-001"}']) {
      expect(parseLocalView(raw)).toEqual(adminView());
    }
  });
  it("keeps a canonical player choice and removes irrelevant coach identity fields", () => {
    expect(parseLocalView(JSON.stringify(player))).toEqual(player);
    expect(parseLocalView('{"role":"coach","athleteCode":"SYN-001"}')).toEqual(coach);
  });
  it("keeps player view unselected when its stored athlete code is absent or malformed", () => {
    for (const athleteCode of [undefined, null, 1, "", "syn-001", " SYN-001", "SYN-001/../../import", "A", "A".repeat(41)]) {
      expect(parseLocalView(JSON.stringify({ role: "player", athleteCode }))).toEqual({ role: "player", athleteCode: null });
    }
  });
});

describe("local view projection", () => {
  it("preserves the full workspace for admin and coach without cloning or changing readings", () => {
    const before = JSON.stringify({ roster, readings });
    for (const view of [adminView(), coach]) {
      const result = projectLocalView(view, roster, readings);
      expect(result.roster).toBe(roster);
      expect(result.measurements).toBe(readings);
    }
    expect(JSON.stringify({ roster, readings })).toBe(before);
  });
  it("projects one exact athlete code, retaining the original profile and observation provenance", () => {
    const before = JSON.stringify({ roster, readings });
    const result = projectLocalView(player, roster, readings);
    expect(result.roster).toEqual([roster.find(a => a.athlete_code === "SYN-001")]);
    expect(result.roster[0]).toBe(roster.find(a => a.athlete_code === "SYN-001"));
    expect(result.measurements).toEqual([readings[0]]);
    expect(result.measurements[0]).toBe(readings[0]);
    expect(result.measurements[0].value).toBe(0);
    expect(JSON.stringify({ roster, readings })).toBe(before);
  });
  it("exposes no profile or readings for an unselected or missing athlete, even with orphan readings", () => {
    for (const athleteCode of [null, "SYN-999", "syn-001", "SYN-001-OTHER"]) {
      expect(projectLocalView({ role: "player", athleteCode }, roster, readings)).toEqual({ roster: [], measurements: [] });
    }
    expect(projectLocalView(player, [], readings)).toEqual({ roster: [], measurements: [] });
  });
  it("fails closed when a selected code is duplicated instead of showing an ambiguous identity", () => {
    const selected = roster.find(a => a.athlete_code === "SYN-001")!;
    expect(projectLocalView(player, [...roster, { ...selected, first_name: "Fictional Duplicate" }], readings)).toEqual({ roster: [], measurements: [] });
  });
});

describe("local preview navigation rules", () => {
  it("allows admin management and coach team/profile views", () => {
    for (const path of ["/preview", "/preview/roster", "/preview/athletes/SYN-002", "/preview/import", "/preview/access"]) {
      expect(localViewAllowsPath(adminView(), path)).toBe(true);
    }
    for (const path of ["/preview", "/preview/roster", "/preview/athletes/SYN-002"]) {
      expect(localViewAllowsPath(coach, path)).toBe(true);
    }
  });
  it("blocks management paths, trailing slashes and descendants for both restricted previews", () => {
    for (const view of [coach, player]) {
      for (const path of ["/preview/import", "/preview/import/", "/preview/import/nested", "/preview/access", "/preview/access/", "/preview/access/nested"]) {
        expect(localViewAllowsPath(view, path), `${view.role}: ${path}`).toBe(false);
      }
    }
  });
  it("limits player navigation to their exact profile and own overview", () => {
    expect(localViewAllowsPath(player, "/preview")).toBe(true);
    expect(localViewAllowsPath(player, "/preview/athletes/SYN-001")).toBe(true);
    for (const path of ["/preview/roster", "/preview/athletes/SYN-002", "/preview/athletes/SYN-001-OTHER", "/preview/athletes/SYN-001/edit"]) {
      expect(localViewAllowsPath(player, path)).toBe(false);
    }
    expect(localViewAllowsPath({ role: "player", athleteCode: null }, "/preview")).toBe(true);
    expect(localViewAllowsPath({ role: "player", athleteCode: null }, "/preview/athletes/SYN-001")).toBe(false);
  });
});
