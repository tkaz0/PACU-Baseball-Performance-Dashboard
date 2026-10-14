import { isValidElement, type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { RosterAthlete } from "@/lib/types";

const fake = vi.hoisted(() => ({ state: vi.fn(), lane: vi.fn(), category: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useId: () => "fictional-session", useState: fake.state }));
vi.mock("@/components/renpho-import", () => ({ RenphoReportForm: () => null }));
vi.mock("@/components/blast-motion-import", () => ({ BlastMotionImport: () => null }));
vi.mock("@/components/full-swing-import", () => ({ FullSwingImport: () => null }));
vi.mock("@/app/(workspace)/imports/actions", () => ({
  loadPitchAssignments: vi.fn(), savePitchAssignments: vi.fn(), loadSharedReportMeasurements: vi.fn(), matchSharedRenphoPlayer: vi.fn(),
  saveReviewedMeasurements: vi.fn(), saveReviewedRenphoMeasurements: vi.fn(), saveReviewedFullSwingSamples: vi.fn(), saveReviewedExistingFullSwingSamples: vi.fn(),
}));
vi.mock("@/app/(workspace)/imports/session-actions", () => ({ loadFullSwingSession: vi.fn(), publishFullSwingSession: vi.fn() }));
import { TeamImportCenter } from "@/components/team-import-center";
import { FullSwingImport } from "@/components/full-swing-import";

type Element = ReactElement<Record<string, unknown>>;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...elements(value.props.children)];
}
function render(lane: string, category: string) {
  fake.state.mockReturnValueOnce([lane, fake.lane]).mockReturnValueOnce([category, fake.category]).mockReturnValueOnce([false, vi.fn()]);
  return elements(TeamImportCenter({ roster: [{ id: "fictional", athlete_code: "SYN-001" } as RosterAthlete] }));
}
beforeEach(() => vi.resetAllMocks());

it.each([["hitting", "game"], ["pitching", "intrasquad"], ["games", "practice"]])("retains the %s review and chosen %s session when its active lane is clicked", (lane, category) => {
  const nodes = render(lane, category), importer = nodes.find(node => node.type === FullSwingImport)!;
  const active = nodes.find(node => node.type === "button" && node.props["aria-pressed"] === true)!;
  expect(importer.key).toBe(`${lane}:${category}`);
  expect(importer.props.sourceCategory).toBe(category);
  (active.props.onClick as () => void)();
  // Neither state defining the importer's mount identity may change: its open file,
  // reviewed matches and identical-retry payload must stay with the same instance.
  expect(fake.lane).not.toHaveBeenCalled();
  expect(fake.category).not.toHaveBeenCalled();
});

it("still applies the intended default session when switching to a different lane", () => {
  const nodes = render("hitting", "game");
  const games = nodes.find(node => node.type === "button" && node.key === "games")!;
  (games.props.onClick as () => void)();
  expect(fake.lane).toHaveBeenCalledWith("games");
  expect(fake.category).toHaveBeenCalledWith("intrasquad");
});
