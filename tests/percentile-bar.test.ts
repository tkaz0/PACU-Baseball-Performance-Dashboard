import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PercentileBar } from "@/components/percentile-bar";
import { percentileColor } from "@/lib/percentile-color";
describe("Pacific percentile presentation", () => {
  it("uses blue, a neutral midpoint and red without changing percentile values", () => {
    expect(percentileColor(0).backgroundColor).toBe("rgb(23, 100, 174)");
    expect(percentileColor(50).backgroundColor).toBe("rgb(230, 231, 233)");
    expect(percentileColor(100).backgroundColor).toBe("rgb(195, 33, 50)");
    const html = renderToStaticMarkup(createElement(PercentileBar, { value: 87.125, sampleSize: 8, label: "Fictional test" }));
    expect(html).toContain('aria-valuenow="87.125"'); expect(html).toContain('left:87.125%'); expect(html).toContain('>87</span>');
  });
  it("keeps badge text above WCAG AA contrast across the entire scale", () => {
    for (let value = 0; value <= 100; value += 0.5) {
      const color = percentileColor(value), rgb = color.backgroundColor.match(/\d+/g)!.map(Number);
      const l = rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [.2126,.7152,.0722][i], 0);
      const foreground = color.color === '#ffffff' ? 1 : 0;
      expect((Math.max(l, foreground) + .05) / (Math.min(l, foreground) + .05)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each([NaN, Infinity, -1, 101])("omits invalid values %s", value => expect(renderToStaticMarkup(createElement(PercentileBar, { value: value, sampleSize: 8, label: "Test" }))).toBe(""));
  it("does not chart small cohorts and keeps body ranks descriptive", () => {
    expect(renderToStaticMarkup(createElement(PercentileBar, { value: 50, sampleSize: 4, label: "Weight" }))).toBe("");
    expect(renderToStaticMarkup(createElement(PercentileBar, { value: 50, sampleSize: 5, label: "Weight", descriptive: true }))).toContain("measured value, not a rating");
  });
});
