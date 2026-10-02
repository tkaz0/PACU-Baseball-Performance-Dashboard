import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { headshotSrc, initialsOf } from "@/lib/headshots";
import { PlayerAvatar } from "@/components/player-avatar";
import { PercentileRing } from "@/components/charts/percentile-ring";
import { Sparkline } from "@/components/charts/sparkline";

describe("headshots", () => {
  it("builds athletics-site URLs only from reviewed image paths", () => {
    expect(headshotSrc("/images/2026/2/23/0_Fictional_Player.jpg", 120)).toBe("https://goboxers.com/images/2026/2/23/0_Fictional_Player.jpg?width=120&quality=85");
    for (const bad of [null, "", "https://example.com/a.jpg", "/images/../secret.jpg", "/images/2026/2/23/a.svg"]) expect(headshotSrc(bad)).toBeNull();
  });
  it("falls back to initials without a photo", () => {
    expect(initialsOf("Fictional Player")).toBe("FP");
    const html = renderToStaticMarkup(createElement(PlayerAvatar, { name: "Fictional Player", path: null }));
    expect(html).toContain("FP"); expect(html).not.toContain("<img");
    expect(renderToStaticMarkup(createElement(PlayerAvatar, { name: "Fictional Player", path: "/images/2026/2/23/0_Fictional_Player.jpg" }))).toContain("no-referrer");
  });
});

describe("charts", () => {
  it("clamps percentile rings and labels them for screen readers", () => {
    const html = renderToStaticMarkup(createElement(PercentileRing, { value: 104.6, label: "Fictional stat" }));
    expect(html).toContain("Fictional stat: 100th percentile on the team");
    expect(renderToStaticMarkup(createElement(PercentileRing, { value: 40, label: "Height", neutral: true }))).toContain("var(--text-secondary)");
  });
  it("draws a trend only with at least two tests", () => {
    expect(renderToStaticMarkup(createElement(Sparkline, { points: [{ date: "2026-09-01", value: 1 }], label: "One test" }))).toBe("");
    expect(renderToStaticMarkup(createElement(Sparkline, { points: [{ date: "2026-09-01", value: 1 }, { date: "2026-09-08", value: 2 }], label: "Two tests" }))).toContain("<polyline");
  });
});
