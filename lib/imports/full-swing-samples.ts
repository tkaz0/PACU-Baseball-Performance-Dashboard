import type { Measurement } from "@/lib/imports/engine";
import type { FullSwingSession } from "@/lib/imports/full-swing-session";
import { SESSION_METRICS } from "@/lib/imports/full-swing-session";

export type ReviewedFullSwingSample = {
  athleteCode: string; fileHash: string; metricKey: string; unit: string;
  sourceRow: number; sampleCount: number; expectedValue: number;
};

/** Match reviewed session counts to the exact saved summary coordinates. */
export function fullSwingSamplesForImport(session: FullSwingSession, matches: readonly { identity: string; athleteCode: string }[], rows: readonly Measurement[]): ReviewedFullSwingSample[] {
  const identities = new Map(matches.map(match => [match.athleteCode, match.identity]));
  const samples = new Map(session.samples.map(sample => [JSON.stringify([sample.identity, sample.metric]), sample]));
  return rows.flatMap(row => {
    const identity = identities.get(row.athlete_code);
    const metric = SESSION_METRICS.find(item => item.label === row.metric && item.unit === row.unit);
    const sample = identity && metric && samples.get(JSON.stringify([identity, metric.label]));
    if (!sample || !metric || sample.count < 1) return [];
    return [{ athleteCode: row.athlete_code, fileHash: row.file_hash, metricKey: metric.key,
      unit: row.unit, sourceRow: row.source_row, sampleCount: sample.count, expectedValue: row.value }];
  });
}
