import { describe, expect, it } from "vitest";
import { graphicsSize, renderGraphics, type GraphicsCard, type GraphicsFormat, type GraphicsTheme } from "@/lib/graphics-renderer";

const formats: GraphicsFormat[] = ["square", "portrait", "story", "landscape"];
const themes: GraphicsTheme[] = ["black", "red", "cream"];
const kinds: GraphicsCard["kind"][] = ["player", "spotlight", "percentiles", "arsenal", "trend", "leaderboard", "comparison", "dashboard"];
const metric = (label: string, value: string, percentile: number | null = null) => ({ label, value, percentile, sample: "Sep 10–24, 2026 · 34 verified readings" });
function fictional(kind: GraphicsCard["kind"]): GraphicsCard {
  return {
    kind, title: "Fall Performance", subtitle: "Fictional fixture · Practice", name: "Example River", meta: "#00 · Two-Way · Fall 2026",
    updated: "Updated Sep 29, 2026", source: "Fictional verified summary",
    metrics: [metric("Average Velocity", "82.4 mph", 73), metric("Max Velocity", "87.1 mph", 90), metric("Average Spin", "2,031.2 rpm", 44)],
    ranking: [
      { rank: 1, name: "Example River", value: "87.1 mph", sample: "34 verified pitches" },
      { rank: 1, name: "Example Grove", value: "87.1 mph", sample: "26 verified pitches" },
      { rank: 3, name: "Example Bay", value: "85.0 mph", sample: "18 verified pitches" },
    ],
    pitches: [
      { name: "Four-Seam Fastball", velocity: 82.4, maxVelocity: 87.1, spin: 2031.2, maxSpin: 2188.3, context: "Fall average / Fall best", sample: "34 velocity · 31 spin readings" },
      { name: "Slider", velocity: 76.8, maxVelocity: 80.2, spin: 2194.5, maxSpin: 2335.7, context: "Latest average Sep 24", sample: "Count unavailable" },
      { name: "Changeup", velocity: 75.6, maxVelocity: 78, spin: null, maxSpin: null, sample: "18 velocity readings" },
    ],
    trend: [{ date: "2026-09-10", value: 79.8 }, { date: "2026-09-17", value: 81.6 }, { date: "2026-09-24", value: 82.4 }],
    trendLabel: "Practice Velocity", trendUnit: "mph",
    comparison: { names: ["Example River", "Example Grove"], rows: [{ label: "Average Velocity", a: "82.4 mph", b: "81.8 mph" }, { label: "Max Velocity", a: "87.1 mph", b: "87.1 mph" }, { label: "Average Spin", a: "2,031.2 rpm", b: "—" }] },
    footerNotes: ["Synthetic fixture only. Percentiles describe the same source, unit and period.", "Missing readings remain unavailable; spin is descriptive."],
  };
}
const attribute = (tag: string, name: string) => Number(new RegExp("\\b" + name + '="([^"]+)"').exec(tag)?.[1]);
const visibleText = (svg: string) => [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(match => match[1]).join(" ");

describe("graphics exports", () => {
  it("returns fresh explicit pixel sizes for all output formats", () => {
    expect(formats.map(graphicsSize)).toEqual([{ width: 1080, height: 1080 }, { width: 1080, height: 1350 }, { width: 1080, height: 1920 }, { width: 1600, height: 900 }]);
    const copy = graphicsSize("square"); copy.width = 1;
    expect(graphicsSize("square").width).toBe(1080);
  });
  for (const kind of kinds) for (const format of formats) for (const theme of themes) {
    it(kind + " keeps geometry on the " + format + " page in " + theme, () => {
      const svg = renderGraphics(fictional(kind), { format, theme });
      const { width, height } = graphicsSize(format);
      expect(svg).toContain('viewBox="0 0 ' + width + " " + height + '"');
      expect(svg).not.toMatch(/\b(?:NaN|Infinity|undefined)\b|<foreignObject|<script|<style|<metadata|url\(/);
      expect(svg).toContain("Independent project");
      expect(svg).toContain("pacubaseballperformance.com");
      expect(svg).toContain("Source: Fictional verified summary");
      expect(svg).toContain("Missing readings remain unavailable; spin is descriptive.");
      for (const tag of svg.match(/<(?:text|rect|image|circle|line)\b[^>]*>/g) ?? []) {
        if (tag.startsWith("<rect") || tag.startsWith("<image")) {
          const x = attribute(tag, "x"), y = attribute(tag, "y"), w = attribute(tag, "width"), h = attribute(tag, "height");
          expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
          expect(w).toBeGreaterThanOrEqual(0); expect(h).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(width + .1); expect(y + h).toBeLessThanOrEqual(height + .1);
        } else if (tag.startsWith("<text")) {
          expect(attribute(tag, "x")).toBeGreaterThanOrEqual(0);
          expect(attribute(tag, "x")).toBeLessThanOrEqual(width);
          expect(attribute(tag, "y") - attribute(tag, "font-size")).toBeGreaterThanOrEqual(0);
          expect(attribute(tag, "y") + attribute(tag, "font-size") * .25).toBeLessThanOrEqual(height);
        } else if (tag.startsWith("<circle")) {
          expect(attribute(tag, "cx") - attribute(tag, "r")).toBeGreaterThanOrEqual(0);
          expect(attribute(tag, "cy") - attribute(tag, "r")).toBeGreaterThanOrEqual(0);
          expect(attribute(tag, "cx") + attribute(tag, "r")).toBeLessThanOrEqual(width);
          expect(attribute(tag, "cy") + attribute(tag, "r")).toBeLessThanOrEqual(height);
        }
      }
    });
  }
  it("escapes every supplied text surface and never serializes unknown properties", () => {
    const attack = '<script x="a">&\'</script>';
    const card = fictional("dashboard");
    Object.assign(card, { title: attack, subtitle: attack, name: attack, meta: attack, source: attack, updated: attack, footerNotes: [attack], secretAthleteId: "DO-NOT-SERIALIZE", provenance: { fileHash: "PRIVATE-HASH" } });
    card.metrics = [metric(attack, attack)];
    const svg = renderGraphics(card, { format: "story", theme: "black" });
    expect(svg).not.toContain("<script"); expect(svg).not.toContain("DO-NOT-SERIALIZE"); expect(svg).not.toContain("PRIVATE-HASH");
    expect(svg).toContain("&lt;script x=&quot;a&quot;&gt;&amp;&apos;&lt;/script&gt;");
    const comparison = fictional("comparison");
    comparison.comparison = { names: [attack, attack], rows: [{ label: attack, a: attack, b: attack }] };
    expect(renderGraphics(comparison, { format: "story", theme: "cream" })).not.toContain("<script");
    for (const kind of ["arsenal", "leaderboard", "trend"] as const) {
      const input = fictional(kind); input.pitches![0].name = attack; input.ranking![0].name = attack; input.trendLabel = attack; input.trendUnit = attack;
      expect(renderGraphics(input, { format: "story", theme: "red" })).not.toContain("<script");
    }
  });
  it("allows only a PNG data URL and preserves the complete logo proportions", () => {
    const card = fictional("player"), safe = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const svg = renderGraphics(card, { format: "square", theme: "black", logoDataUrl: safe });
    expect(svg).toContain('width="118" height="80" preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('href="' + safe + '"');
    for (const url of ["https://example.com/logo.png", "data:image/svg+xml,<svg onload='alert(1)'/>", safe + '" onload="alert(1)', "data:image/png;base64,not-a-png", "javascript:alert(1)"]) {
      expect(renderGraphics(card, { format: "square", theme: "black", logoDataUrl: url })).not.toContain("<image");
    }
  });
  it("preserves supplied tie ranks instead of assigning ordinal positions", () => {
    const card = fictional("leaderboard");
    const svg = renderGraphics(card, { format: "story", theme: "cream" });
    expect(svg.match(/>01<\/text>/g)).toHaveLength(2);
    expect(svg).toContain(">03</text>"); expect(svg).not.toContain(">02</text>");
  });
  it("withholds invalid ranks and percentiles and preserves a true zero percentile", () => {
    const card = fictional("percentiles");
    card.metrics = [metric("Unranked", "82.4 mph", null), metric("Invalid", "—", 101), metric("Nonfinite", "NaN", Infinity), metric("Zero", "79.0 mph", 0)];
    const svg = renderGraphics(card, { format: "story", theme: "black" });
    expect(svg.match(/Percentile unavailable/g)).toHaveLength(3);
    expect(svg).toContain(">0 / 100</text>"); expect(svg).not.toMatch(/NaN|Infinity|101 \/ 100/);
    card.kind = "leaderboard"; card.ranking = [{ name: "Invalid", value: "9", rank: NaN }, { name: "Invalid", value: "9", rank: 0 }];
    expect(renderGraphics(card, { format: "square", theme: "black" })).toContain("No verified rankings available");
  });
  it("retains four arsenal measures, one decimal, units, and missing spin without zero-fill", () => {
    const svg = renderGraphics(fictional("arsenal"), { format: "story", theme: "cream" });
    for (const value of ["AVG mph", "MAX mph", "AVG rpm", "MAX rpm", "82.4", "87.1", "2031.2", "2188.3", "78.0", "Count unavailable", "Latest average Sep 24"]) expect(svg).toContain(value);
    expect(svg.match(/>—<\/text>/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("filters nonfinite plot points and invalid dates without generating false points", () => {
    const card = fictional("trend");
    card.trend = [{ date: "2026-09-10", value: Infinity }, { date: "2026-02-30", value: 80 }, { date: "not-a-date", value: 80 }, { date: "2026-09-24", value: 82.4 }];
    const svg = renderGraphics(card, { format: "portrait", theme: "black" });
    expect(svg.match(/<circle /g)).toHaveLength(1); expect(svg).not.toContain("<polyline");
    expect(svg).not.toMatch(/NaN|Infinity/); expect(svg).toContain("Sep 24");
    card.trend = [{ date: "2026-09-10", value: Number.MAX_VALUE }, { date: "2026-09-24", value: -Number.MAX_VALUE }];
    expect(renderGraphics(card, { format: "portrait", theme: "black" })).not.toMatch(/NaN|Infinity/);
  });
  it("labels omitted rows and keeps mandatory notes intact instead of squeezing or dropping them", () => {
    const card = fictional("leaderboard");
    card.ranking = Array.from({ length: 45 }, (_, i) => ({ name: "Example Player " + i, value: "82.4 mph", rank: i + 1 }));
    const svg = renderGraphics(card, { format: "square", theme: "red" });
    expect(svg).toMatch(/\+\d+ ranked players not shown/);
    card.footerNotes = Array.from({ length: 40 }, () => "A mandatory formula qualification must remain visible.");
    expect(() => renderGraphics(card, { format: "square", theme: "black" })).toThrow(/cannot fit the required notes/);
  });
  it("renders empty datasets as unavailable without sample data", () => {
    for (const kind of kinds) {
      const svg = renderGraphics({ kind, title: "Fictional empty", subtitle: "", metrics: [] }, { format: "square", theme: "cream" });
      expect(svg).toContain("available"); expect(svg).not.toMatch(/Example River|82\.4/);
    }
  });
  it("preserves metric units at the text-fitting boundary", () => {
    for (const kind of ["player", "dashboard"] as const) {
      expect(renderGraphics(fictional(kind), { format: "square", theme: "black" })).toContain(">2,031.2 rpm</text>");
    }
  });
  it("shows comparison sample evidence separately and keeps complete pitch contexts", () => {
    const comparison = fictional("comparison");
    comparison.comparison!.rows[0] = { label: "Average Velocity", a: "82.4 mph", b: "81.8 mph", aSample: "Sep 1–24 · 34 velocity readings", bSample: "Sep 10–27 · 31 velocity readings" };
    const svg = renderGraphics(comparison, { format: "story", theme: "black" });
    expect(visibleText(svg)).toContain("34 velocity readings"); expect(visibleText(svg)).toContain("31 velocity readings");
    const arsenal = fictional("arsenal");
    arsenal.pitches![0].context = "Velocity average Sep 1–24; spin average Sep 5–27; velocity max Sep 19; spin max Sep 23; complete independent date windows.";
    const output = renderGraphics(arsenal, { format: "story", theme: "cream" });
    expect(visibleText(output)).toContain("spin max Sep 23"); expect(visibleText(output)).toContain("complete independent date windows.");
    arsenal.pitches![0].context = "Long context evidence. ".repeat(200);
    expect(() => renderGraphics(arsenal, { format: "square", theme: "black" })).toThrow(/taller format/);
  });
  it("uses the existing descriptive blue-to-red percentile palette", () => {
    const card = fictional("percentiles");
    card.metrics = [metric("Lower numerical rank", "1", 25), metric("Higher numerical rank", "2", 100)];
    const svg = renderGraphics(card, { format: "square", theme: "cream" });
    expect(svg).toContain('fill="rgb(104, 166, 212)"'); expect(svg).toContain('fill="rgb(195, 33, 50)"');
  });
  it("keeps the complete mark above headlines and honors a two-line portrait title", () => {
    const card = fictional("dashboard"); card.title = "People Lie,\nNumbers Don’t.";
    const logoDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const svg = renderGraphics(card, { format: "portrait", theme: "black", logoDataUrl });
    const logo = svg.match(/<image\b[^>]*>/)![0];
    const headline = svg.match(/<text\b[^>]*>People Lie,<\/text>/)![0];
    expect(attribute(logo, "y") + attribute(logo, "height")).toBeLessThan(attribute(headline, "y") - attribute(headline, "font-size"));
    expect(svg).toContain(">Numbers Don’t.</text>");
  });
});
