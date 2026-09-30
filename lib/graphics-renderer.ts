import { percentileColor } from "@/lib/percentile-color";

/** Pure, local SVG composition. The caller supplies an already authorized visible-data projection. */
export type GraphicsFormat = "square" | "portrait" | "story" | "landscape";
export type GraphicsTheme = "black" | "red" | "cream";
export interface GraphicsCard {
  kind: "player" | "spotlight" | "percentiles" | "arsenal" | "trend" | "leaderboard" | "comparison" | "dashboard";
  title: string;
  subtitle: string;
  name?: string;
  meta?: string;
  updated?: string;
  source?: string;
  metrics: { label: string; value: string; percentile?: number | null; sample?: string }[];
  ranking?: { name: string; value: string; rank: number; sample?: string }[];
  pitches?: { name: string; velocity: number | null; spin: number | null; maxVelocity: number | null; maxSpin: number | null; sample?: string; context?: string }[];
  trend?: { date: string; value: number }[];
  trendLabel?: string;
  trendUnit?: string;
  comparison?: { names: [string, string]; rows: { label: string; a: string; b: string; aSample?: string; bSample?: string }[] };
  footerNotes?: string[];
}
export type GraphicsOptions = { format: GraphicsFormat; theme: GraphicsTheme; logoDataUrl?: string };
const sizes = { square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 }, landscape: { width: 1600, height: 900 } } as const;
export function graphicsSize(format: GraphicsFormat): { width: number; height: number } {
  return { ...(sizes[format] ?? sizes.square) };
}
type Palette = { background: string; panel: string; raised: string; ink: string; muted: string; line: string; accent: string; accentInk: string };
const palettes: Record<GraphicsTheme, Palette> = {
  black: { background: "#131519", panel: "#202329", raised: "#2c3038", ink: "#faf6ee", muted: "#c0bdb8", line: "#41434a", accent: "#ed3d43", accentInk: "#fffaf2" },
  red: { background: "#a71016", panel: "#880d12", raised: "#bd3337", ink: "#fffaf2", muted: "#f2cfcb", line: "#ca5e5f", accent: "#fff3df", accentInk: "#921017" },
  cream: { background: "#f3eee3", panel: "#fffcf5", raised: "#e8e0d2", ink: "#17191d", muted: "#5c5a55", line: "#c9c0b2", accent: "#b51217", accentInk: "#fffaf2" },
};
type Box = { x: number; y: number; w: number; h: number };
const clean = (value: string) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffe\uffff]/g, "").replace(/[\ud800-\udfff]/gu, "").replace(/\s+/g, " ").trim();
const escape = (value: string) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const display = (value: string) => /^(?:[-+]?Infinity|NaN)$/i.test(clean(value)) ? "—" : clean(value) || "—";
const fixed = (value: number | null | undefined) => finite(value) ? value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }) : "—";
const shortNumber = (value: number) => Math.abs(value) >= 1000000 ? value.toExponential(1) : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const n = (value: number) => Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
// Conservative Arial advance estimates permit deterministic fitting without browser/font access.
function textWidth(value: string, size: number, bold = false): number {
  return [...clean(value)].reduce((sum, char) => sum + (/[ilI1.,:;'!| ]/.test(char) ? .29 : /[MW@%&]/.test(char) ? .94 : /[A-Z0-9]/.test(char) ? .69 : /[^\u0000-\u024f]/.test(char) ? 1 : .57), 0) * size * (bold ? 1.04 : 1);
}
function shorten(value: string, width: number, size: number, bold = false): string {
  const full = clean(value);
  if (textWidth(full, size, bold) <= width + .1) return full;
  let result = "";
  for (const char of full) {
    if (textWidth(result + char + "…", size, bold) > width + .1) break;
    result += char;
  }
  return result.trimEnd() + "…";
}
function wrap(value: string, width: number, size: number): string[] {
  const words = clean(value).split(" ").filter(Boolean), lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && textWidth(line + " " + word, size) > width) { lines.push(line); line = ""; }
    if (textWidth(word, size) > width) {
      if (line) { lines.push(line); line = ""; }
      let chunk = "";
      for (const char of word) {
        if (textWidth(chunk + char, size) > width && chunk) { lines.push(chunk); chunk = ""; }
        chunk += char;
      }
      line = chunk;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}
function safeLogo(url?: string): string | null {
  // Only PNG base64 with a PNG signature; no SVG, remote URLs, attributes, or HTML.
  return url && url.length <= 3000000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(url) ? url : null;
}
function dateNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? parsed : null;
}
function dateLabel(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** No caller object, private identifiers, remote references or hidden metadata are serialized. */
export function renderGraphics(card: GraphicsCard, options: GraphicsOptions): string {
  const { width, height } = graphicsSize(options.format), p = palettes[options.theme] ?? palettes.black;
  const wide = width > height, margin = wide ? 76 : 64, inner = width - margin * 2;
  const parts: string[] = [];
  const text = (value: string, x: number, y: number, size: number, color = p.ink, weight = 400, anchor = "start") =>
    parts.push('<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + n(size) + '" fill="' + color + '" font-weight="' + weight + '" text-anchor="' + anchor + '">' + escape(value) + "</text>");
  const fit = (value: string, x: number, y: number, maxWidth: number, size: number, minimum: number, color = p.ink, weight = 700, anchor = "start") => {
    const fittedSize = Math.max(minimum, Math.min(size, maxWidth / Math.max(1, textWidth(value, 1, weight >= 600))));
    text(shorten(value, maxWidth, fittedSize, weight >= 600), x, y, fittedSize, color, weight, anchor);
  };
  const rect = (b: Box, fill: string, radius = 0, stroke?: string) =>
    parts.push('<rect x="' + n(b.x) + '" y="' + n(b.y) + '" width="' + n(Math.max(0, b.w)) + '" height="' + n(Math.max(0, b.h)) + '" rx="' + n(radius) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '"' : "") + "/>");
  const line = (x1: number, y1: number, x2: number, y2: number, color = p.line, strokeWidth = 1) =>
    parts.push('<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + color + '" stroke-width="' + n(strokeWidth) + '"/>');
  const circle = (x: number, y: number, radius: number, fill = p.accent) =>
    parts.push('<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(radius) + '" fill="' + fill + '"/>');
  const lines = (value: string, x: number, y: number, maxWidth: number, size: number, maxLines = 2, color = p.muted) => {
    const rows = wrap(value, maxWidth, size);
    rows.slice(0, maxLines).forEach((row, index) => text(index === maxLines - 1 && rows.length > maxLines ? shorten(row + " …", maxWidth, size) : row, x, y + index * size * 1.25, size, color));
  };
  const more = (count: number, b: Box, label = "additional entries") => {
    if (count > 0) text("+" + count + " " + label + " not shown", b.x, b.y + b.h - 5, 20, p.muted);
  };
  const empty = (b: Box, message: string) => {
    rect(b, p.panel, 12, p.line);
    fit(message, b.x + 30, b.y + Math.min(b.h / 2 + 10, 80), b.w - 60, 32, 22, p.muted, 400);
  };

  rect({ x: 0, y: 0, w: width, h: height }, p.background);
  rect({ x: 0, y: 0, w: width, h: 12 }, p.accent);
  // Quiet baseball-diamond geometry stays outside the data area.
  parts.push('<path d="M ' + n(width - 188) + " 24 L " + n(width - 24) + " 188 L " + n(width - 24) + " 24 Z" + '" fill="none" stroke="' + p.line + '" stroke-width="1"/>');
  text("PACIFIC BASEBALL", margin, 66, 25, p.ink, 700);
  const logo = safeLogo(options.logoDataUrl);
  if (logo) parts.push('<image x="' + n(width - margin - 118) + '" y="20" width="118" height="80" preserveAspectRatio="xMidYMid meet" href="' + logo + '"/>');
  else text("PERFORMANCE", margin, 94, 16, p.muted, 700);
  const titleLines = !wide && /[\r\n]/.test(card.title) ? card.title.split(/\r?\n/).map(clean).filter(Boolean).slice(0, 2) : [card.title];
  titleLines.forEach((title, i) => fit(title, margin, 166 + i * 64, inner, 58, 32));
  const headerShift = 10 + Math.max(0, titleLines.length - 1) * 64;
  const subtitles = wrap(card.subtitle, inner, 24).slice(0, 2);
  subtitles.forEach((subtitle, i) => text(subtitle, margin, 197 + headerShift + i * 29, 24, p.muted));
  let bodyTop = (subtitles.length > 1 ? 258 : 230) + headerShift;
  if (card.name) { fit(card.name, margin, bodyTop + 55, inner, wide ? 76 : 80, 40); bodyTop += 82; }
  if (card.meta) { fit(card.meta, margin, bodyTop + 8, inner, 24, 20, p.muted, 400); bodyTop += 40; }

  // Notes are visible content, including formula qualifications. Do not silently truncate them.
  const footerRows = [
    ...(card.source ? wrap("Source: " + card.source, inner, 20) : []),
    ...(card.updated ? wrap(card.updated, inner, 20) : []),
    ...(card.footerNotes ?? []).flatMap(note => wrap(note, inner, 20)),
  ];
  const footerHeight = 90 + footerRows.length * 25;
  const footerTop = height - footerHeight;
  const minimumBody = card.kind === "trend" && card.metrics.length ? wide ? 250 : 400 : card.kind === "player" && card.metrics.length > 1 ? wide ? 200 : 355 : card.kind === "spotlight" && card.metrics.length > 1 ? 310 : 200;
  if (footerTop - bodyTop - 27 < minimumBody) throw new Error("The selected format cannot fit the required notes. Choose a taller format or fewer metrics.");
  line(margin, footerTop, width - margin, footerTop);
  footerRows.forEach((row, i) => text(row, margin, footerTop + 31 + i * 25, 20, p.muted));
  text("pacubaseballperformance.com", margin, height - 52, 18, p.muted, 700);
  text("Independent project · Not an official university application.", margin, height - 28, 18, p.muted);
  const body: Box = { x: margin, y: bodyTop, w: inner, h: footerTop - bodyTop - 27 };
  const metrics = card.metrics ?? [];

  const metricTile = (metric: GraphicsCard["metrics"][number], b: Box, hero = false) => {
    rect(b, hero ? p.accent : p.panel, 12, hero ? undefined : p.line);
    const ink = hero ? p.accentInk : p.ink, muted = hero ? p.accentInk : p.muted;
    const pad = b.w < 300 ? 22 : 28;
    const compact = b.h < 180, sampleSize = compact ? 18 : 20;
    fit(metric.label, b.x + pad, b.y + (compact ? 28 : 36), b.w - pad * 2, compact ? 21 : 25, 18, muted, 700);
    const sampleRows = metric.sample ? wrap(metric.sample, b.w - pad * 2, sampleSize).slice(0, 2) : [];
    const sampleStart = b.y + b.h - 19 - Math.max(0, sampleRows.length - 1) * sampleSize * 1.25;
    const valueTop = b.y + (compact ? 40 : 54);
    const valueBottom = sampleRows.length ? sampleStart - sampleSize - 10 : b.y + b.h - 23;
    const font = Math.min(hero ? 154 : 90, Math.max(24, (valueBottom - valueTop) / 1.2));
    fit(display(metric.value), b.x + pad, valueTop + font, b.w - pad * 2, font, Math.min(28, font), ink, 700);
    if (metric.sample) lines(metric.sample, b.x + pad, sampleStart, b.w - pad * 2, sampleSize, 2, muted);
  };
  const grid = (items: GraphicsCard["metrics"], b: Box, columns = 2, max = 6, firstHero = false) => {
    if (!items.length) return empty(b, "No verified metrics available");
    const maxRows = Math.max(1, Math.floor((b.h - 30 + 16) / 176));
    const count = Math.min(items.length, max, maxRows * columns);
    const shown = items.slice(0, count), notice = items.length > count ? 30 : 0;
    const rows = Math.ceil(count / columns), gap = 16, cellWidth = (b.w - gap * (columns - 1)) / columns, cellHeight = (b.h - notice - gap * (rows - 1)) / rows;
    shown.forEach((metric, i) => metricTile(metric, { x: b.x + (i % columns) * (cellWidth + gap), y: b.y + Math.floor(i / columns) * (cellHeight + gap), w: cellWidth, h: cellHeight }, firstHero && i === 0));
    more(items.length - count, b, "metrics");
  };

  const plot = (b: Box, values: { x: number; y: number; name?: string }[], xLabel: string, yLabel: string, connect = false, labels?: { first: string; last: string }) => {
    rect(b, p.panel, 12, p.line);
    fit(yLabel, b.x + 24, b.y + 33, b.w - 48, 21, 18, p.muted, 700);
    if (!values.length) return fit("No paired readings available", b.x + 24, b.y + b.h / 2, b.w - 48, 28, 20, p.muted, 400);
    const chart = { x: b.x + 84, y: b.y + 64, w: b.w - 124, h: b.h - 126 };
    const xs = values.map(v => v.x), ys = values.map(v => v.y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ratio = (value: number, min: number, max: number) => {
      if (min === max) return .5;
      const scale = Math.max(Math.abs(min), Math.abs(max), 1);
      return (value / scale - min / scale) / (max / scale - min / scale);
    };
    const coords = values.map(value => ({ ...value, px: chart.x + ratio(value.x, minX, maxX) * chart.w, py: chart.y + (1 - ratio(value.y, minY, maxY)) * chart.h }));
    for (let i = 0; i < 4; i++) {
      const t = i / 3, y = chart.y + chart.h * (1 - t), value = minY * (1 - t) + maxY * t;
      line(chart.x, y, chart.x + chart.w, y);
      fit(shortNumber(value), chart.x - 12, y + 6, 60, 18, 14, p.muted, 400, "end");
    }
    line(chart.x, chart.y + chart.h, chart.x + chart.w, chart.y + chart.h, p.muted);
    if (connect && coords.length > 1) parts.push('<polyline points="' + coords.map(v => n(v.px) + "," + n(v.py)).join(" ") + '" fill="none" stroke="' + p.accent + '" stroke-width="4" stroke-linejoin="round"/>');
    coords.forEach((value, i) => {
      circle(value.px, value.py, connect ? 6 : 8, p.accent);
      if (value.name) {
        const right = value.px > chart.x + chart.w * .55;
        fit(value.name, value.px + (right ? -13 : 13), Math.min(chart.y + chart.h - 4, Math.max(chart.y + 17, value.py - 13 + (i % 2) * 20)), Math.min(145, chart.w * .43), 19, 16, p.ink, 700, right ? "end" : "start");
      }
    });
    text(labels?.first ?? shortNumber(minX), chart.x, chart.y + chart.h + 28, 18, p.muted);
    text(labels?.last ?? shortNumber(maxX), chart.x + chart.w, chart.y + chart.h + 28, 18, p.muted, 400, "end");
    fit(xLabel, b.x + b.w / 2, b.y + b.h - 15, b.w - 48, 19, 16, p.muted, 400, "middle");
  };

  if (card.kind === "player") {
    if (!metrics.length) empty(body, "No verified metrics available");
    else if (metrics.length === 1) metricTile(metrics[0], body, true);
    else if (wide) {
      metricTile(metrics[0], { ...body, w: body.w * .46 }, true);
      grid(metrics.slice(1), { ...body, x: body.x + body.w * .46 + 18, w: body.w * .54 - 18 }, 2, 4);
    } else {
      const heroHeight = Math.max(174, body.h * .43);
      metricTile(metrics[0], { ...body, h: heroHeight }, true);
      grid(metrics.slice(1), { ...body, y: body.y + heroHeight + 18, h: body.h - heroHeight - 18 }, 2, 4);
    }
  } else if (card.kind === "spotlight") {
    if (!metrics.length) empty(body, "No verified metric available");
    else {
      const secondaryHeight = metrics.length > 1 ? Math.min(210, Math.max(175, body.h * .4)) : 0;
      metricTile(metrics[0], { ...body, h: body.h - secondaryHeight - (secondaryHeight ? 18 : 0) }, true);
      if (secondaryHeight) grid(metrics.slice(1), { ...body, y: body.y + body.h - secondaryHeight, h: secondaryHeight }, wide ? 3 : 2, wide ? 3 : 2);
    }
  } else if (card.kind === "dashboard") {
    grid(metrics, body, wide ? 3 : 2, wide ? 6 : options.format === "story" ? 10 : 6, true);
  } else if (card.kind === "percentiles") {
    if (!metrics.length) empty(body, "No verified percentiles available");
    else {
      const count = Math.min(metrics.length, Math.max(1, Math.floor((body.h - 30) / 138))), shown = metrics.slice(0, count);
      const rowHeight = Math.min(180, (body.h - (metrics.length > count ? 30 : 0)) / count);
      shown.forEach((metric, i) => {
        const y = body.y + i * rowHeight;
        fit(metric.label, body.x, y + 28, body.w * .58, 27, 20);
        fit(display(metric.value), body.x + body.w, y + 28, body.w * .36, 30, 22, p.ink, 700, "end");
        const percentile = metric.percentile;
        if (finite(percentile) && percentile >= 0 && percentile <= 100) {
          rect({ x: body.x, y: y + 47, w: body.w - 135, h: 12 }, p.raised, 6);
          if (percentile > 0) rect({ x: body.x, y: y + 47, w: (body.w - 135) * percentile / 100, h: 12 }, percentileColor(percentile).backgroundColor, 6);
          text(shortNumber(percentile) + " / 100", body.x + body.w, y + 61, 22, p.ink, 700, "end");
        } else text("Percentile unavailable", body.x, y + 64, 21, p.muted);
        if (metric.sample) lines(metric.sample, body.x, y + 89, body.w, 20, 2);
        if (i < count - 1) line(body.x, y + rowHeight - 9, body.x + body.w, y + rowHeight - 9);
      });
      more(metrics.length - count, body, "metrics");
    }
  } else if (card.kind === "leaderboard") {
    const ranking = (card.ranking ?? []).filter(row => Number.isSafeInteger(row.rank) && row.rank > 0);
    if (!ranking.length) empty(body, "No verified rankings available");
    else {
      const count = Math.min(ranking.length, Math.max(1, Math.floor((body.h - 30) / 120))), rowHeight = Math.min(172, (body.h - (ranking.length > count ? 30 : 0)) / count);
      ranking.slice(0, count).forEach((row, i) => {
        const y = body.y + i * rowHeight;
        rect({ x: body.x, y, w: body.w, h: rowHeight - 12 }, i === 0 ? p.accent : p.panel, 8);
        const ink = i === 0 ? p.accentInk : p.ink;
        fit(String(row.rank).padStart(2, "0"), body.x + 24, y + 57, 84, 46, 28, ink);
        fit(row.name, body.x + 126, y + 43, body.w * .56 - 126, 30, 22, ink);
        fit(display(row.value), body.x + body.w - 26, y + 55, body.w * .4 - 20, 48, 26, ink, 700, "end");
        if (row.sample) lines(row.sample, body.x + 126, y + 73, body.w - 156, 20, 2, i === 0 ? p.accentInk : p.muted);
      });
      more(ranking.length - count, body, "ranked players");
    }
  } else if (card.kind === "comparison") {
    const comparison = card.comparison;
    if (!comparison?.rows.length) empty(body, "No comparable metrics available");
    else {
      const labelWidth = body.w * .34, valueWidth = (body.w - labelWidth) / 2;
      rect({ ...body, h: 71 }, p.accent, 8);
      fit(comparison.names[0], body.x + labelWidth + valueWidth / 2, body.y + 44, valueWidth - 30, 28, 19, p.accentInk, 700, "middle");
      fit(comparison.names[1], body.x + labelWidth + valueWidth * 1.5, body.y + 44, valueWidth - 30, 28, 19, p.accentInk, 700, "middle");
      text("METRIC", body.x + 23, body.y + 44, 20, p.accentInk, 700);
      const rowSizes = comparison.rows.map(row => Math.max(81, 77 + Math.max(wrap(row.aSample ?? "", valueWidth - 32, 19).length, wrap(row.bSample ?? "", valueWidth - 32, 19).length) * 24));
      const room = body.h - 71;
      if (rowSizes[0] > room - 30) throw new Error("Comparison details need a taller format or fewer footer notes.");
      let count = 0, used = 0;
      for (const size of rowSizes) { if (used + size > room - (count < comparison.rows.length - 1 ? 30 : 0)) break; used += size; count++; }
      let rowY = body.y + 71;
      comparison.rows.slice(0, count).forEach((row, i) => {
        const y = rowY, rowHeight = rowSizes[i]; rowY += rowHeight;
        if (i % 2 === 0) rect({ x: body.x, y, w: body.w, h: rowHeight }, p.panel);
        lines(row.label, body.x + 23, y + 38, labelWidth - 42, 22, 2, p.ink);
        fit(display(row.a), body.x + labelWidth + valueWidth / 2, y + 45, valueWidth - 32, 39, 24, p.ink, 700, "middle");
        fit(display(row.b), body.x + labelWidth + valueWidth * 1.5, y + 45, valueWidth - 32, 39, 24, p.ink, 700, "middle");
        [row.aSample, row.bSample].forEach((sample, j) => wrap(sample ?? "", valueWidth - 32, 19).forEach((detail, k) => text(detail, body.x + labelWidth + valueWidth * (j + .5), y + 73 + k * 24, 19, p.muted, 400, "middle")));
        line(body.x, y + rowHeight, body.x + body.w, y + rowHeight);
      });
      more(comparison.rows.length - count, body, "comparison rows");
    }
  } else if (card.kind === "arsenal") {
    const pitches = card.pitches ?? [];
    if (!pitches.length) empty(body, "No classified pitch summaries available");
    else {
      let table = { ...body };
      const hasPlot = body.h >= 790 || (wide && pitches.length <= 4 && body.h >= 365);
      if (hasPlot) {
        const plotBox = wide ? { ...body, w: body.w * .4 } : { ...body, h: Math.min(400, body.h * .35) };
        plot(plotBox, pitches.flatMap(pitch => finite(pitch.velocity) && finite(pitch.spin) ? [{ x: pitch.velocity, y: pitch.spin, name: pitch.name }] : []), "Average Velocity (mph)", "Average Spin (rpm)");
        table = wide ? { ...body, x: body.x + body.w * .4 + 22, w: body.w * .6 - 22 } : { ...body, y: body.y + plotBox.h + 26, h: body.h - plotBox.h - 26 };
      }
      const nameWidth = table.w * .3, metricWidth = (table.w - nameWidth) / 4;
      ["AVG mph", "MAX mph", "AVG rpm", "MAX rpm"].forEach((label, i) => fit(label, table.x + nameWidth + metricWidth * (i + .5), table.y + 24, metricWidth - 9, 20, 15, p.muted, 700, "middle"));
      text("PITCH", table.x, table.y + 24, 20, p.muted, 700);
      const details = pitches.map(pitch => wrap([pitch.context, pitch.sample].filter(Boolean).join(" · "), table.w - 20, 20));
      const rowSizes = details.map(rows => Math.max(70, 65 + rows.length * 25));
      if (rowSizes[0] > table.h - 70) throw new Error("Pitch dates and sample details need a taller format or fewer footer notes.");
      let count = 0, used = 0;
      for (const size of rowSizes) { if (used + size > table.h - 40 - (count < pitches.length - 1 ? 30 : 0)) break; used += size; count++; }
      let rowY = table.y + 41;
      pitches.slice(0, count).forEach((pitch, i) => {
        const y = rowY, rowHeight = rowSizes[i]; rowY += rowHeight;
        if (i % 2 === 0) rect({ x: table.x - 10, y, w: table.w + 20, h: rowHeight }, p.panel, 5);
        fit(pitch.name, table.x + 10, y + 36, nameWidth - 22, 24, 18);
        [pitch.velocity, pitch.maxVelocity, pitch.spin, pitch.maxSpin].forEach((value, j) => fit(fixed(value), table.x + nameWidth + metricWidth * (j + .5), y + 38, metricWidth - 12, 31, 19, p.ink, 700, "middle"));
        details[i].forEach((detail, j) => text(detail, table.x + 10, y + 65 + j * 25, 20, p.muted));
        line(table.x, y + rowHeight, table.x + table.w, y + rowHeight);
      });
      more(pitches.length - count, table, "pitch types");
    }
  } else if (card.kind === "trend") {
    const points = (card.trend ?? []).flatMap(point => {
      const timestamp = dateNumber(point.date);
      return timestamp !== null && finite(point.value) ? [{ x: timestamp, y: point.value, date: point.date }] : [];
    }).sort((a, b) => a.x - b.x);
    if (!points.length) empty(body, "No dated trend readings available");
    else {
      const cardsHeight = metrics.length ? Math.min(225, Math.max(190, body.h * .36)) : 0;
      const chartBox = wide && metrics.length ? { ...body, w: body.w * .64 - 18 } : { ...body, h: body.h - cardsHeight - (cardsHeight ? 18 : 0) };
      plot(chartBox, points, card.trendLabel ?? "Recorded Sessions", card.trendUnit ? "Recorded Value (" + card.trendUnit + ")" : "Recorded Value", true, { first: dateLabel(points[0].date), last: dateLabel(points.at(-1)!.date) });
      if (cardsHeight) grid(metrics, wide ? { ...body, x: body.x + body.w * .64, w: body.w * .36 } : { ...body, y: body.y + body.h - cardsHeight, h: cardsHeight }, wide ? 1 : 2, 2);
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escape(card.title) + '" font-family="Arial, Helvetica, sans-serif">' + parts.join("") + "</svg>";
}
