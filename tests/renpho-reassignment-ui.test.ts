import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/(workspace)/admin/import/renpho/corrections/single-actions", () => ({ reviewSingleReportCorrection: vi.fn(), saveSingleReportCorrection: vi.fn() }));
import { RenphoReportReassignment } from "@/components/renpho-report-reassignment";

describe("single report correction presentation", () => {
  it("includes destination players without a report and starts collapsed with saving unavailable", () => {
    const html = renderToStaticMarkup(createElement(RenphoReportReassignment, {
      reports: [{ fileHash: "a".repeat(64), athleteCode: "SYN-001", athleteName: "Fictional Source", sourceFile: "fictional.png", measuredAt: "2026-10-02", measurementCount: 3, hasHeight: false }],
      players: [{ athleteCode: "SYN-001", athleteName: "Fictional Source" }, { athleteCode: "SYN-003", athleteName: "Fictional Destination" }],
    }));
    expect(html).toContain("Move one report to the correct player");
    expect(html).not.toContain("<details open");
    expect(html).toContain('value="SYN-003"');
    expect(html).toContain("Fictional Destination");
    expect(html).toContain("Printed RENPHO ID (optional)");
    expect(html).toContain("Additional Numeric ID (optional)");
    expect(html).toContain("Blank fields leave ID assignments unchanged");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Review Report Move/);
    expect(html).not.toContain("Save Report Move");
  });
});
