import type { ExitMeetingInsight, ExitMeetingReport } from "@/lib/exit-meeting";

/** Instructions for the profile summary; the data block is built by `summaryData` below. */
export const SUMMARY_SYSTEM = `Write a short Fall 2026 recap of one player for his coaches, from the data that follows.
Refer to him as "he" or by role (never invent a name). Three short paragraphs, about 150 words total:
1. What stood out (his best results, with the numbers and team percentiles).
2. Where the numbers show room to grow (with the numbers).
3. Notable changes across the Fall, if the data shows any; otherwise skip this paragraph.
Finish with nothing else: no sign-off, no advice.`;

const pct = (p: number | null) => p === null ? "" : `, team percentile ${Math.round(p)}`;
const insight = (i: ExitMeetingInsight) => `- ${i.label}: ${i.detail}${pct(i.percentile)}`;

/**
 * The profile's verified exit-meeting projection as plain text, with identity removed (no name, PAC code or jersey).
 * Role, position, class and handedness stay so the summary can speak to the right skills.
 */
export function summaryData(report: ExitMeetingReport): string {
  const lines = [
    `Season: ${report.season}`,
    `Position: ${report.position || "not recorded"} · Class: ${report.academicClass || "not recorded"} · Bats/Throws: ${report.batsThrows || "not recorded"}`,
    report.lastTested ? `Last tested: ${report.lastTested}` : "No saved testing date",
    report.lastGameUpdate ? `Game stats through: ${report.lastGameUpdate}` : "No game stats saved",
  ];
  if (report.strengths.length) lines.push("", "Strengths the dashboard found:", ...report.strengths.map(insight));
  if (report.development.length) lines.push("", "Development areas the dashboard found:", ...report.development.map(insight));
  if (report.jumps.length) lines.push("", "Biggest changes between tests:", ...report.jumps.map(insight));
  for (const section of report.sections) {
    if (!section.rows.length) continue;
    lines.push("", `${section.title}${section.subtitle ? ` (${section.subtitle})` : ""}:`);
    for (const row of section.rows) {
      const trend = row.trend && row.trend.length > 1 ? `, week by week ${row.trend.map(t => t.value).join(" → ")}` : "";
      lines.push(`- ${row.label}: ${row.value}${row.sample ? ` (${row.sample})` : ""}${pct(row.percentile)}${row.peers ? ` of ${row.peers}` : ""}${trend} [${row.source}${row.date ? `, ${row.date}` : ""}]`);
    }
  }
  if (report.missing.length) lines.push("", `Not recorded this Fall: ${report.missing.join(", ")}`);
  return lines.join("\n");
}
