import { describe, expect, it } from "vitest";
import { renderGraphics, type GraphicsCard } from "@/lib/graphics-renderer";

const card: GraphicsCard = { kind: "trading", title: "PACIFIC BOXERS", subtitle: "", name: "Fictional Boxer", meta: "RHP · Junior", metrics: [
  { label: "Max Velocity", value: "84.2 mph", sample: "12 pitches" }, { label: "Avg Spin", value: "2,140 RPM" }, { label: "WHIP", value: "1.12", sample: "18.0 IP" },
] };

describe("trading card graphic", () => {
  it("renders every format with the position mark and three stats", () => {
    for (const format of ["square", "portrait", "story", "landscape"] as const) for (const theme of ["black", "red", "cream"] as const) {
      const svg = renderGraphics(card, { format, theme });
      expect(svg).toContain("84.2 mph"); expect(svg).toContain("2,140 RPM"); expect(svg).toContain("1.12"); expect(svg).toContain(">RHP<");
    }
  });
  it("refuses more than three stats instead of truncating", () => {
    expect(() => renderGraphics({ ...card, metrics: [...card.metrics, { label: "K/9", value: "9.00" }] }, { format: "portrait", theme: "black" })).toThrow();
  });
});
