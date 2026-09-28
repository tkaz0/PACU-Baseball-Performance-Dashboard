import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/app/(workspace)/analytics/view-actions", () => ({ saveAnalyticsView: vi.fn(), archiveAnalyticsView: vi.fn() }));
import { AnalyticsExplorer } from "@/components/analytics-explorer";

it("puts accessible explanations beside both correlation scores even before results arrive", () => {
  const html = renderToStaticMarkup(createElement(AnalyticsExplorer, { data: { players: [], readings: [] } }));
  expect(html).toContain('aria-label="About Pearson r"');
  expect(html).toContain('aria-label="About R²"');
  expect(html).toContain("players shown");
  expect(html).toContain("trend line");
});
