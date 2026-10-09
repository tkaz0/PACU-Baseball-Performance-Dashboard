import { percentileColor } from "@/lib/percentile-color";

/** Pure, local SVG composition. The caller supplies an already authorized visible-data projection. */
export type GraphicsFormat = "square" | "portrait" | "story" | "landscape";
export type GraphicsTheme = "black" | "red" | "cream";
export interface GraphicsCard {
  kind: "player" | "spotlight" | "percentiles" | "arsenal" | "trend" | "leaderboard" | "comparison" | "dashboard" | "weekly";
  title: string;
  subtitle: string;
  kicker?: string;
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
  captionDetails?: string[];
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
const pitchColors = ["#ed6570", "#65addc", "#dfb354", "#6db49b", "#ad97dc", "#d990ba", "#99b378", "#df9a72"];
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

/** Export only the visible design. Source notes and caption details stay in the review UI. */
export function renderGraphics(card: GraphicsCard, options: GraphicsOptions): string {
  const { width, height } = graphicsSize(options.format), p = palettes[options.theme] ?? palettes.black;
  const wide = width > height, margin = wide ? 76 : 64, inner = width - margin * 2;
  const rawMetrics = card.metrics ?? [];
  const commonSample = ["player", "percentiles"].includes(card.kind) && rawMetrics.length > 1 && clean(rawMetrics[0].sample ?? "") && rawMetrics.every(metric => metric.sample === rawMetrics[0].sample) ? rawMetrics[0].sample : undefined;
  const metrics = commonSample ? rawMetrics.map(metric => ({ ...metric, sample: undefined })) : rawMetrics;
  const parts: string[] = [];
  const overflow = () => { throw new Error("These selected stats need a larger format. Choose Story or select fewer stats."); };
  const text = (value: string, x: number, y: number, size: number, color = p.ink, weight = 400, anchor = "start") =>
    parts.push('<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + n(size) + '" fill="' + color + '" font-weight="' + weight + '" text-anchor="' + anchor + '">' + escape(value) + "</text>");
  const fit = (value: string, x: number, y: number, maxWidth: number, size: number, minimum: number, color = p.ink, weight = 700, anchor = "start") => {
    const fitted = Math.min(size, maxWidth / Math.max(1, textWidth(value, 1, weight >= 600)));
    if (fitted < minimum) overflow();
    text(value, x, y, fitted, color, weight, anchor);
  };
  const rect = (b: Box, fill: string, radius = 0, stroke?: string) =>
    parts.push('<rect x="' + n(b.x) + '" y="' + n(b.y) + '" width="' + n(Math.max(0, b.w)) + '" height="' + n(Math.max(0, b.h)) + '" rx="' + n(radius) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '"' : "") + "/>");
  const line = (x1: number, y1: number, x2: number, y2: number, color = p.line, strokeWidth = 1) =>
    parts.push('<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + color + '" stroke-width="' + n(strokeWidth) + '"/>');
  const circle = (x: number, y: number, radius: number, fill = p.accent) =>
    parts.push('<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(radius) + '" fill="' + fill + '"/>');
  const detailLines = (value: string | undefined, maxWidth: number, size = 20) => {
    const rows = wrap(value ?? "", maxWidth, size);
    if (rows.length > 2) throw new Error("Keep inline sample text to two short lines; put full details in the caption.");
    return rows;
  };
  const drawLines = (rows: string[], x: number, y: number, size = 20, color = p.muted, anchor = "start") =>
    rows.forEach((row, index) => text(row, x, y + index * size * 1.25, size, color, 400, anchor));
  const empty = (b: Box, message: string) => {
    rect(b, p.panel, 10, p.line);
    fit(message, b.x + 30, b.y + b.h / 2 + 10, b.w - 60, 34, 22, p.muted, 400);
  };

  rect({ x: 0, y: 0, w: width, h: height }, p.background);
  rect({ x: 0, y: 0, w: width, h: 12 }, p.accent);
  // Original field-line geometry; the supplied complete logo remains unaltered.
  parts.push('<path d="M ' + n(width - 216) + ' 18 L ' + n(width - 18) + ' 216 M ' + n(width - 142) + ' 18 L ' + n(width - 18) + ' 142" fill="none" stroke="' + p.line + '" stroke-width="2"/>');
  text("PACIFIC BASEBALL", margin, 66, 26, p.ink, 700);
  if (card.kicker) fit(card.kicker, margin, 105, inner - 155, 23, 18, p.muted, 600);
  const logo = safeLogo(options.logoDataUrl);
  if (logo) parts.push('<image x="' + n(width - margin - 118) + '" y="25" width="118" height="80" preserveAspectRatio="xMidYMid meet" href="' + logo + '"/>');

  let bodyTop: number;
  if (card.name) {
    fit(card.title, margin, 163, inner, 31, 23, p.muted, 700);
    fit(card.name, margin, 252, inner, wide ? 92 : 90, 44);
    const identity = [card.meta, card.subtitle, commonSample].filter(value => value && clean(value) !== clean(card.kicker ?? "")).join(" · ");
    if (identity) fit(identity, margin, 293, inner, 24, 19, p.muted, 400);
    bodyTop = 335;
  } else {
    const titleLines = !wide && /[\r\n]/.test(card.title) ? card.title.split(/\r?\n/).map(clean).filter(Boolean) : [card.title];
    if (titleLines.length > 2) overflow();
    titleLines.forEach((title, i) => fit(title, margin, 204 + i * 82, inner, 82, 38));
    const subtitleY = 247 + Math.max(0, titleLines.length - 1) * 82;
    const subtitle = [card.subtitle && clean(card.subtitle) !== clean(card.kicker ?? "") ? card.subtitle : "", commonSample].filter(Boolean).join(" · ");
    if (subtitle) fit(subtitle, margin, subtitleY, inner, 25, 20, p.muted, 400);
    bodyTop = subtitleY + 42;
  }
  const body: Box = { x: margin, y: bodyTop, w: inner, h: height - bodyTop - margin };
  if (body.h < 230) overflow();

  const metricTile = (metric: GraphicsCard["metrics"][number], b: Box, hero = false) => {
    if (b.h < 158) overflow();
    rect(b, hero ? p.accent : p.panel, 10, hero ? undefined : p.line);
    const ink = hero ? p.accentInk : p.ink, muted = hero ? p.accentInk : p.muted;
    const pad = b.w < 320 ? 22 : 32, compact = b.h < 220;
    const labelSize = compact ? 23 : 28;
    const labelRows = wrap(metric.label, b.w - pad * 2, labelSize);
    if (labelRows.length > 2) overflow();
    labelRows.forEach((row, i) => text(row, b.x + pad, b.y + 34 + i * labelSize * 1.2, labelSize, muted, 700));
    const samples = detailLines(metric.sample, b.w - pad * 2, 20);
    const sampleStart = b.y + b.h - 25 - Math.max(0, samples.length - 1) * 25;
    const top = b.y + 44 + labelRows.length * labelSize * 1.2;
    const bottom = samples.length ? sampleStart - 31 : b.y + b.h - 28;
    const valueSize = Math.min(hero ? 204 : 126, Math.max(24, (bottom - top) / 1.15));
    const baseline = top + (bottom - top) / 2 + valueSize * .33;
    fit(display(metric.value), b.x + pad, baseline, b.w - pad * 2, valueSize, 23, ink);
    drawLines(samples, b.x + pad, sampleStart, 20, muted);
  };
  const grid = (items: GraphicsCard["metrics"], b: Box, columns = 2, firstHero = false) => {
    if (!items.length) return empty(b, "No verified metrics available");
    columns = Math.min(columns, items.length);
    const rows = Math.ceil(items.length / columns), gap = 18;
    const cellWidth = (b.w - gap * (columns - 1)) / columns, cellHeight = (b.h - gap * (rows - 1)) / rows;
    if (cellHeight < 158 || cellWidth < 230) overflow();
    items.forEach((metric, i) => {
      const lastSingle = items.length % columns === 1 && i === items.length - 1;
      metricTile(metric, { x: b.x + (i % columns) * (cellWidth + gap), y: b.y + Math.floor(i / columns) * (cellHeight + gap), w: lastSingle ? b.w : cellWidth, h: cellHeight }, firstHero && i === 0);
    });
  };

  const plot = (b: Box, values: { x: number; y: number; color?: string }[], xLabel: string, yLabel: string, connect = false, labels?: { first: string; last: string }) => {
    if (b.w < 300 || b.h < 250) overflow();
    rect(b, p.panel, 10, p.line);
    fit(yLabel, b.x + 27, b.y + 40, b.w - 54, 23, 18, p.muted, 700);
    if (!values.length) return fit("Paired readings unavailable", b.x + 27, b.y + b.h / 2, b.w - 54, 28, 18, p.muted, 400);
    const chart = { x: b.x + 88, y: b.y + 81, w: b.w - 139, h: b.h - 154 };
    const xs = values.map(v => v.x), ys = values.map(v => v.y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ratio = (value: number, min: number, max: number) => {
      if (min === max) return .5;
      const scale = Math.max(Math.abs(min), Math.abs(max), 1);
      return (value / scale - min / scale) / (max / scale - min / scale);
    };
    const coords = values.map(value => ({ px: chart.x + ratio(value.x, minX, maxX) * chart.w, py: chart.y + (1 - ratio(value.y, minY, maxY)) * chart.h, color: value.color }));
    for (let i = 0; i < 4; i++) {
      const t = i / 3, y = chart.y + chart.h * (1 - t), value = minY * (1 - t) + maxY * t;
      line(chart.x, y, chart.x + chart.w, y);
      fit(shortNumber(value), chart.x - 15, y + 7, 65, 19, 10, p.muted, 400, "end");
    }
    if (connect && coords.length > 1) parts.push('<polyline points="' + coords.map(v => n(v.px) + "," + n(v.py)).join(" ") + '" fill="none" stroke="' + p.accent + '" stroke-width="5" stroke-linejoin="round"/>');
    coords.forEach(value => circle(value.px, value.py, connect ? 7 : 10, value.color ?? p.accent));
    text(labels?.first ?? shortNumber(minX), chart.x, chart.y + chart.h + 31, 20, p.muted);
    text(labels?.last ?? shortNumber(maxX), chart.x + chart.w, chart.y + chart.h + 31, 20, p.muted, 400, "end");
    fit(xLabel, b.x + b.w / 2, b.y + b.h - 18, b.w - 54, 21, 17, p.muted, 400, "middle");
  };

  if (card.kind === "player") {
    if (!metrics.length) empty(body, "No verified metrics available");
    else if (metrics.length === 1) metricTile(metrics[0], body, true);
    else if (wide) {
      metricTile(metrics[0], { ...body, w: body.w * .48 - 10 }, true);
      grid(metrics.slice(1), { ...body, x: body.x + body.w * .48 + 10, w: body.w * .52 - 10 }, metrics.length <= 3 ? 1 : 2);
    } else {
      const heroHeight = Math.max(220, body.h * .43);
      metricTile(metrics[0], { ...body, h: heroHeight }, true);
      grid(metrics.slice(1), { ...body, y: body.y + heroHeight + 18, h: body.h - heroHeight - 18 }, 2);
    }
  } else if (card.kind === "spotlight") {
    if (!metrics.length) empty(body, "No verified metric available");
    else {
      const columns = wide ? 3 : 2, secondaryRows = Math.ceil((metrics.length - 1) / columns);
      const secondaryHeight = metrics.length > 1 ? Math.max(secondaryRows * 165 + (secondaryRows - 1) * 18, body.h * .29) : 0;
      if (body.h - secondaryHeight < 210) overflow();
      metricTile(metrics[0], { ...body, h: body.h - secondaryHeight - (secondaryHeight ? 18 : 0) }, true);
      if (secondaryHeight) grid(metrics.slice(1), { ...body, y: body.y + body.h - secondaryHeight, h: secondaryHeight }, columns);
    }
  } else if (card.kind === "weekly") {
    if (!metrics.length) empty(body, "No weekly leaders yet");
    else grid(metrics, body, wide ? 2 : 1);
  } else if (card.kind === "dashboard") {
    grid(metrics, body, wide ? 3 : 2, true);
  } else if (card.kind === "percentiles") {
    if (!metrics.length) empty(body, "No verified percentiles available");
    else {
      const columns = wide && metrics.length > 3 ? 2 : 1, rows = Math.ceil(metrics.length / columns);
      const gap = 17, rowHeight = (body.h - gap * (rows - 1)) / rows, rowWidth = (body.w - (columns - 1) * gap) / columns;
      if (rowHeight < 137) overflow();
      metrics.forEach((metric, i) => {
        const y = body.y + Math.floor(i / columns) * (rowHeight + gap), x = body.x + (i % columns) * (rowWidth + gap), pad = 28;
        rect({ x, y, w: rowWidth, h: rowHeight }, p.panel, 10, p.line);
        const center = y + rowHeight / 2;
        fit(metric.label, x + pad, center - 25, rowWidth * .56 - pad, 34, 22);
        fit(display(metric.value), x + rowWidth - pad, center - 25, rowWidth * .39 - pad, 44, 25, p.ink, 700, "end");
        const percentile = metric.percentile, barWidth = rowWidth - 195 - pad * 2;
        if (finite(percentile) && percentile >= 0 && percentile <= 100) {
          rect({ x: x + pad, y: center - 2, w: barWidth, h: 15 }, p.raised, 7);
          if (percentile > 0) rect({ x: x + pad, y: center - 2, w: barWidth * percentile / 100, h: 15 }, percentileColor(percentile).backgroundColor, 7);
          text(shortNumber(percentile) + " / 100", x + rowWidth - pad, center + 16, 25, p.ink, 700, "end");
        } else text("Percentile unavailable", x + pad, center + 17, 22, p.muted);
        drawLines(detailLines(metric.sample, rowWidth - pad * 2, 20), x + pad, center + 43);
      });
    }
  } else if (card.kind === "leaderboard") {
    const ranking = card.ranking ?? [];
    if (!ranking.length) empty(body, "No verified rankings available");
    else {
      if (ranking.some(row => !Number.isSafeInteger(row.rank) || row.rank < 1)) throw new Error("A selected ranking has no verified rank.");
      const gap = 12, rowHeight = (body.h - gap * (ranking.length - 1)) / ranking.length;
      if (rowHeight < (wide ? 84 : 105)) overflow();
      ranking.forEach((row, i) => {
        const y = body.y + i * (rowHeight + gap), lead = row.rank === Math.min(...ranking.map(r => r.rank));
        const ink = lead ? p.accentInk : p.ink;
        rect({ x: body.x, y, w: body.w, h: rowHeight }, lead ? p.accent : p.panel, 8);
        const baseline = y + rowHeight / 2 + 11;
        const compact = rowHeight < 118;
        fit(String(row.rank).padStart(2, "0"), body.x + 25, baseline, 92, compact ? 44 : 65, 32, ink);
        fit(row.name, body.x + 139, baseline - 12, body.w * .61 - 139, compact ? 31 : 37, 22, ink);
        fit(display(row.value), body.x + body.w - 29, baseline, body.w * .35, compact ? 46 : 62, 27, ink, 700, "end");
        const samples = detailLines(row.sample, body.w - 171, compact ? 18 : 20);
        if (compact && samples.length > 1) overflow();
        drawLines(samples, body.x + 139, baseline + 18, compact ? 18 : 20, lead ? p.accentInk : p.muted);
      });
    }
  } else if (card.kind === "comparison") {
    const comparison = card.comparison;
    if (!comparison?.rows.length) empty(body, "No comparable metrics available");
    else {
      const labelWidth = body.w * .32, valueWidth = (body.w - labelWidth) / 2, headingHeight = wide ? 70 : 86;
      rect({ ...body, h: headingHeight }, p.accent, 8);
      fit(comparison.names[0], body.x + labelWidth + valueWidth / 2, body.y + 52, valueWidth - 36, 31, 20, p.accentInk, 700, "middle");
      fit(comparison.names[1], body.x + labelWidth + valueWidth * 1.5, body.y + 52, valueWidth - 36, 31, 20, p.accentInk, 700, "middle");
      text("VS", body.x + 28, body.y + 53, 30, p.accentInk, 700);
      const rowHeight = (body.h - headingHeight) / comparison.rows.length;
      if (rowHeight < (wide ? 78 : 117)) overflow();
      comparison.rows.forEach((row, i) => {
        const y = body.y + headingHeight + i * rowHeight, center = y + rowHeight / 2;
        if (i % 2 === 0) rect({ x: body.x, y, w: body.w, h: rowHeight }, p.panel);
        drawLines(detailLines(row.label, labelWidth - 50, 25), body.x + 28, center - 5, 25, p.ink);
        const compact = rowHeight < 117;
        fit(display(row.a), body.x + labelWidth + valueWidth / 2, center + 1, valueWidth - 32, compact ? 38 : 56, 27, p.ink, 700, "middle");
        fit(display(row.b), body.x + labelWidth + valueWidth * 1.5, center + 1, valueWidth - 32, compact ? 38 : 56, 27, p.ink, 700, "middle");
        [row.aSample, row.bSample].forEach((sample, j) => {
          const samples = detailLines(sample, valueWidth - 32, 19);
          if (compact && samples.length > 1) overflow();
          drawLines(samples, body.x + labelWidth + valueWidth * (j + .5), center + 32, 19, p.muted, "middle");
        });
        line(body.x + 28, y + rowHeight, body.x + body.w - 28, y + rowHeight);
      });
    }
  } else if (card.kind === "arsenal") {
    const pitches = card.pitches ?? [];
    if (!pitches.length) empty(body, "No classified pitch summaries available");
    else if (wide) {
      const columns = Math.min(3, pitches.length), rows = Math.ceil(pitches.length / columns), gap = 18;
      const panelWidth = (body.w - (columns - 1) * gap) / columns, panelHeight = (body.h - (rows - 1) * gap) / rows;
      if (panelHeight < 310) overflow();
      pitches.forEach((pitch, index) => {
        const x = body.x + (index % columns) * (panelWidth + gap), y = body.y + Math.floor(index / columns) * (panelHeight + gap);
        rect({ x, y, w: panelWidth, h: panelHeight }, p.panel, 10, p.line);
        rect({ x: x + 28, y: y + 25, w: 42, h: 5 }, pitchColors[index % pitchColors.length], 2);
        fit(pitch.name, x + 28, y + 73, panelWidth - 56, 35, 22);
        const basis = detailLines(pitch.context, panelWidth - 56, 18);
        drawLines(basis, x + 28, y + 103, 18);
        const metricTop = basis.length ? 135 + (basis.length - 1) * 23 : 110;
        const step = (panelHeight - metricTop - 82) / 2;
        [pitch.velocity, pitch.maxVelocity, pitch.spin, pitch.maxSpin].forEach((value, j) => {
          const cx = x + 28 + (panelWidth - 56) * ((j % 2) + .5) / 2, cy = y + metricTop + Math.floor(j / 2) * step;
          text(["AVG mph", "MAX mph", "AVG rpm", "MAX rpm"][j], cx, cy, 19, p.muted, 700, "middle");
          fit(fixed(value), cx, cy + 65, (panelWidth - 74) / 2, 61, 27, p.ink, 700, "middle");
        });
        const samples = detailLines(pitch.sample, panelWidth - 56, 20);
        drawLines(samples, x + 28, y + panelHeight - 24 - Math.max(0, samples.length - 1) * 25);
      });
    }
    else {
      const minimumRow = pitches.some(pitch => pitch.context) ? 210 : 180, gap = 16, minRows = pitches.length * minimumRow + (pitches.length - 1) * gap;
      if (minRows > body.h) overflow();
      let table = { ...body };
      const paired = pitches.flatMap((pitch, i) => finite(pitch.velocity) && finite(pitch.spin) ? [{ x: pitch.velocity, y: pitch.spin, color: pitchColors[i % pitchColors.length] }] : []);
      const availablePlot = body.h - minRows - 24;
      if (paired.length > 1 && availablePlot >= 330) {
        const plotHeight = Math.min(availablePlot, Math.max(360, body.h * .4));
        plot({ ...body, h: plotHeight }, paired, "Average Velocity (mph)", "Average Spin (rpm)");
        table = { ...body, y: body.y + plotHeight + 24, h: body.h - plotHeight - 24 };
      }
      const rowHeight = (table.h - gap * (pitches.length - 1)) / pitches.length;
      pitches.forEach((pitch, i) => {
        const y = table.y + i * (rowHeight + gap), pad = 28, valueWidth = (table.w - pad * 2) / 4;
        rect({ x: table.x, y, w: table.w, h: rowHeight }, p.panel, 10, p.line);
        rect({ x: table.x, y: y + 23, w: 5, h: 32 }, pitchColors[i % pitchColors.length], 2);
        fit(pitch.name, table.x + pad, y + 40, table.w * .48 - pad, 33, 23);
        const samples = detailLines(pitch.sample, table.w * .48 - pad, 20);
        drawLines(samples, table.x + table.w - pad, y + 35, 20, p.muted, "end");
        const basis = detailLines(pitch.context, table.w - pad * 2, 18);
        drawLines(basis, table.x + pad, y + 82, 18);
        const numberSize = Math.min(74, Math.max(29, rowHeight * .27));
        const numberY = Math.max(y + rowHeight * .78, basis.length ? y + 93 + basis.length * 22 + numberSize + 9 : 0);
        if (numberY + numberSize * .24 > y + rowHeight - 10) overflow();
        ["AVG mph", "MAX mph", "AVG rpm", "MAX rpm"].forEach((label, j) => text(label, table.x + pad + valueWidth * (j + .5), numberY - numberSize - 9, 19, p.muted, 700, "middle"));
        [pitch.velocity, pitch.maxVelocity, pitch.spin, pitch.maxSpin].forEach((value, j) => fit(fixed(value), table.x + pad + valueWidth * (j + .5), numberY, valueWidth - 20, numberSize, 25, p.ink, 700, "middle"));
      });
    }
  } else if (card.kind === "trend") {
    const points = (card.trend ?? []).map(point => {
      const timestamp = dateNumber(point.date);
      if (timestamp === null || !finite(point.value)) throw new Error("A selected trend reading has an invalid date or value.");
      return { x: timestamp, y: point.value, date: point.date };
    }).sort((a, b) => a.x - b.x);
    if (!points.length) empty(body, "No dated trend readings available");
    else {
      const columns = wide && metrics.length <= 2 ? 1 : 2, rows = Math.ceil(metrics.length / columns);
      const cardsHeight = metrics.length ? Math.max(rows * 164 + (rows - 1) * 18, body.h * .3) : 0;
      const chartBox = wide && metrics.length ? { ...body, w: body.w * .62 - 18 } : { ...body, h: body.h - cardsHeight - (cardsHeight ? 18 : 0) };
      plot(chartBox, points, card.trendLabel ?? "Recorded Sessions", card.trendUnit ?? "Recorded Value", true, { first: dateLabel(points[0].date), last: dateLabel(points.at(-1)!.date) });
      if (cardsHeight) grid(metrics, wide ? { ...body, x: body.x + body.w * .62, w: body.w * .38 } : { ...body, y: body.y + body.h - cardsHeight, h: cardsHeight }, columns);
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escape(card.title) + '" font-family="Arial, Helvetica, sans-serif">' + parts.join("") + "</svg>";
}
