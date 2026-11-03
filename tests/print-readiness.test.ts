import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExitMeetingPrintAll } from "@/components/exit-meeting-print-all";

// Fictional names only.
const render = (readiness: Parameters<typeof ExitMeetingPrintAll>[0]["readiness"]) => renderToStaticMarkup(createElement(ExitMeetingPrintAll, { players: [{ id: "a", name: "Fictional Player" }], readiness }));
describe("Print All readiness", () => {
  it("says ready only when no sheet rows need review and no team rate is pending", () => {
    expect(render({ issues: [], pendingRates: [], hittingSaved: "2026-11-03T05:00:00Z", pitchingSaved: "2026-11-03T05:00:00Z" })).toContain("Ready to print");
    const waiting = render({ issues: ["Fictional Player"], pendingRates: ["OPS", "OBP"], hittingSaved: "2026-11-03T05:00:00Z", pitchingSaved: null });
    expect(waiting).toContain("Not every stat is available yet"); expect(waiting).toContain("Fictional Player"); expect(waiting).toContain("OPS, OBP"); expect(waiting).toContain("Pitching sheet saved not saved");
    expect(render({ issues: null, pendingRates: [], hittingSaved: null, pitchingSaved: null })).toContain("could not be checked");
  });
});
