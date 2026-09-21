import type { Measurement } from "@/lib/imports/engine";
import { BLAST_REPORT_METRICS, blastMetricFor, blastPracticeReports, parseBlastSource } from "@/lib/blast-metrics";

export const BLAST_MAIN_KEYS = ["avg_bat_speed", "blast_peak_hand_speed", "blast_attack_angle", "blast_early_connection", "blast_vertical_bat_angle"] as const;
export const BLAST_MAIN_METRICS = BLAST_MAIN_KEYS.map(key => {
  const metric = BLAST_REPORT_METRICS.find(m => m.key === key)!;
  return { ...metric, displayLabel: key === "avg_bat_speed" ? "Bat Speed (Practice)" : key === "blast_peak_hand_speed" ? "Hand Speed" : metric.label };
});
export type BlastFallIssue = "multiple_players" | "conflicting_observations" | "duplicate_reports" | "missing_counts" | "overlapping_periods";
export type BlastFallSummary = {
  issues: BlastFallIssue[]; totalSwings: number | null; reportCount: number; firstDate: string | null; lastDate: string | null;
  peakPeriod: { start: string; end: string } | null;
  metrics: { key: string; label: string; unit: string; average: number | null; missingReports: number; peak: number | null }[];
};

/** Display-only Fall rollup. Never pool vendors, sum paired exports, or average percentiles. */
export function blastFallSummary(readings: readonly Measurement[]): BlastFallSummary | null {
  const original = readings.filter(r => parseBlastSource(r.source));
  if (!original.length) return null;
  const issues = new Set<BlastFallIssue>(), unique = new Map<string, Measurement>();
  if (new Set(original.map(r => r.athlete_code)).size !== 1) issues.add("multiple_players");
  for (const row of original) {
    const prior = unique.get(row.id);
    if (prior && (prior.athlete_code !== row.athlete_code || prior.metric !== row.metric || prior.value !== row.value || prior.unit !== row.unit || prior.source !== row.source || prior.file_hash !== row.file_hash)) issues.add("conflicting_observations");
    unique.set(row.id,row);
  }
  const reports = blastPracticeReports([...unique.values()]);
  const averages = reports.filter(r => r.average.length).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
  const latestPeak = reports.find(r => r.p95.length);
  const countFor = (rows: Measurement[]) => {
    const counts = rows.filter(r => r.metric === "Blast Swing Count" && r.unit === "count");
    return counts.length === 1 && Number.isSafeInteger(counts[0].value) && counts[0].value > 0 ? counts[0].value : null;
  };
  const duplicate = (rows: Measurement[]) => new Set(rows.map(r=>r.file_hash)).size > 1 || new Set(rows.map(r=>`${r.metric}:${r.unit}`)).size !== rows.length;
  const counts = averages.map(report => countFor(report.average));
  if (averages.some(r => duplicate(r.average))) issues.add("duplicate_reports");
  if (counts.some(n => n === null)) issues.add("missing_counts");
  for (let i=1;i<averages.length;i++) if (averages.slice(0,i).some(prior=>prior.end >= averages[i].start)) issues.add("overlapping_periods");
  const sum = counts.reduce<number>((total,n)=>total+(n??0),0);
  if (!Number.isSafeInteger(sum)) issues.add("missing_counts");
  const peakSafe = latestPeak && !duplicate(latestPeak.p95) && countFor(latestPeak.p95)!==null && !issues.has("multiple_players") && !issues.has("conflicting_observations");
  return {
    issues:[...issues], totalSwings:averages.length && !issues.size ? sum : null, reportCount:averages.length,
    firstDate:averages[0]?.start??null,lastDate:averages.map(r=>r.end).sort().at(-1)??null,
    peakPeriod:peakSafe?{start:latestPeak.start,end:latestPeak.end}:null,
    metrics:BLAST_MAIN_METRICS.map(metric=>{
      let weighted=0, n=0, missingReports=0;
      for (let i=0;i<averages.length;i++) {
        const values=averages[i].average.filter(r=>r.metric===metric.label&&r.unit===metric.unit);
        if(values.length!==1 || counts[i]===null){missingReports++;continue;}
        const count=counts[i]!;
        weighted=weighted*(n/(n+count))+values[0].value*(count/(n+count));n+=count;
      }
      const peak=peakSafe?latestPeak.p95.find(r=>r.metric===blastMetricFor(metric.column,"p95").label&&r.unit===metric.unit):undefined;
      return {key:metric.key,label:metric.displayLabel,unit:metric.unit,average:!issues.size&&!missingReports&&n>0&&Number.isFinite(weighted)?weighted:null,missingReports,peak:peak?.value??null};
    }),
  };
}
