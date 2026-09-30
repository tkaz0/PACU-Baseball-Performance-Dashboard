import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filterGroupPlayers, GroupPlayerPicker, groupPickerSelection, toggleGroupPlayer } from "@/components/group-player-picker";
import type { CoachingPlayer } from "@/lib/coaching-tools";
import { groupPresets } from "@/lib/group-comparison";

const player = (index: number, patch: Partial<CoachingPlayer> = {}): CoachingPlayer => ({
  id: `fictional-group-${index}`,
  code: `SYN-${String(index).padStart(3, "0")}`,
  name: `Fictional Player ${index}`,
  academicClass: "Junior",
  position: "OF",
  playerType: "position",
  bats: "R",
  throws: "R",
  ...patch,
});
const fullRoster = Array.from({ length: 120 }, (_, index) => player(index + 1));

describe("group player picker selection", () => {
  it("keeps the complete roster and selection beyond 25, 50, or 100 players", () => {
    const ids = fullRoster.map(item => item.id);
    expect(filterGroupPlayers(fullRoster, "")).toHaveLength(120);
    expect(groupPickerSelection(fullRoster, ids)).toEqual(ids);
    expect(filterGroupPlayers(fullRoster, "SYN-120")).toEqual([fullRoster[119]]);
  });

  it("matches every search term with accent/case normalization across names and PAC codes", () => {
    const roster = [player(1, { name: "Fictional José Álvarez" }), player(2, { name: "Fictional Jordan North" })];
    expect(filterGroupPlayers(roster, "  JOSE alvarez SYN-001  ")).toEqual([roster[0]]);
    expect(filterGroupPlayers(roster, "jordan syn-001")).toEqual([]);
    expect(filterGroupPlayers(roster, "\t \n")).toEqual(roster);
  });

  it("finds primary and secondary positions and recorded two-way roles", () => {
    const roster = [player(1, { position: "P", secondaryPosition: "SS", playerType: "two_way" }), player(2, { position: "LF", secondaryPosition: "2B" })];
    expect(filterGroupPlayers(roster, "ss")).toEqual([roster[0]]);
    expect(filterGroupPlayers(roster, "2b")).toEqual([roster[1]]);
    expect(filterGroupPlayers(roster, "two way")).toEqual([roster[0]]);
  });

  it("deduplicates identities and omits unavailable selected IDs without mutating inputs", () => {
    const roster = [player(1), player(2), player(1)];
    const selected = [roster[1].id, roster[0].id, roster[1].id, "fictional-unavailable"];
    expect(filterGroupPlayers(roster, "").map(item => item.id)).toEqual([roster[0].id, roster[1].id]);
    expect(groupPickerSelection(roster, selected)).toEqual([roster[0].id, roster[1].id]);
    expect(selected).toEqual([roster[1].id, roster[0].id, roster[1].id, "fictional-unavailable"]);
    expect(roster).toHaveLength(3);
  });

  it("selects the entire preset and allows individual removals/additions afterward", () => {
    const pitchers = Array.from({ length: 65 }, (_, index) => player(index + 1, { position: "P", playerType: "pitcher" }));
    const hitter = player(66, { position: "SS" });
    const roster = [...pitchers, hitter];
    const preset = groupPresets(roster).find(item => item.id === "pitchers")!;
    expect(preset.playerIds).toHaveLength(65);
    const selected = groupPickerSelection(roster, preset.playerIds);
    const removed = toggleGroupPlayer(roster, selected, pitchers[30].id);
    expect(removed).toHaveLength(64);
    expect(removed).not.toContain(pitchers[30].id);
    expect(toggleGroupPlayer(roster, removed, hitter.id)).toEqual([...removed, hitter.id]);
    expect(toggleGroupPlayer(roster, removed, pitchers[30].id)).toEqual(selected);
  });

  it("uses the full roster for presets even when a search shows only one result", () => {
    expect(filterGroupPlayers(fullRoster, "SYN-001")).toHaveLength(1);
    const preset = groupPresets(fullRoster).find(item => item.id === "all")!;
    expect(groupPickerSelection(fullRoster, preset.playerIds)).toHaveLength(120);
  });

  it("never lets individual toggles manufacture a player outside the provided roster", () => {
    expect(toggleGroupPlayer(fullRoster, [fullRoster[0].id], "fictional-unavailable")).toEqual([fullRoster[0].id]);
    expect(groupPickerSelection(fullRoster, [])).toEqual([]);
    expect(toggleGroupPlayer([], [], "fictional-unavailable")).toEqual([]);
  });
});

describe("group player picker presentation", () => {
  it("renders a labeled dialog trigger, full checkbox roster, group presets, and completion controls", () => {
    const roster = [player(1, { position: "P", secondaryPosition: "SS", playerType: "two_way" }), player(2, { position: "C" }), player(3, { position: "RF" })];
    const html = renderToStaticMarkup(createElement(GroupPlayerPicker, { players: roster, selectedIds: [roster[0].id], onChange: () => undefined }));
    expect(html).toContain("Choose Players");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<dialog[^>]+aria-labelledby="[^"]+"[^>]+aria-describedby="[^"]+"/);
    expect(html).toContain('aria-label="Search players by name, PAC ID, or position"');
    expect(html).toContain("Players to compare");
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Fictional Player 1"');
    expect(html).toContain("SYN-001 · P · SS");
    for (const preset of groupPresets(roster)) expect(html).toContain(`value="${preset.id}"`);
    expect(html).toContain("Clear All");
    expect(html).toContain("Done");
    expect(html).toContain('aria-label="Close player selection"');
  });

  it("renders every player beyond the initial viewport and counts only available unique selections", () => {
    const ids = fullRoster.map(item => item.id);
    const html = renderToStaticMarkup(createElement(GroupPlayerPicker, { players: fullRoster, selectedIds: [...ids, ids[0], "fictional-unavailable"], onChange: () => undefined }));
    expect(html.match(/type="checkbox"/g)).toHaveLength(120);
    expect(html.match(/checked=""/g)).toHaveLength(120);
    expect(html).toContain("120 players selected");
    expect(html).toContain('aria-label="Fictional Player 120"');
    expect(html).not.toContain("fictional-unavailable");
  });

  it("keeps an empty roster understandable and clears no nonexistent selection", () => {
    const html = renderToStaticMarkup(createElement(GroupPlayerPicker, { players: [], selectedIds: [], onChange: () => undefined }));
    expect(html).toContain("No players are available in this roster.");
    expect(html).toContain("0 players selected");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clear All<\/button>/);
    expect(html).not.toContain('type="checkbox"');
  });
});
