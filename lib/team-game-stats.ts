import { qpaBattingCounts, qpaSheetAB } from "@/lib/qpa-at-bats";
import { battingPowerParts } from "@/lib/advanced-game-stats";
import type { SharedGameStat } from "@/lib/game-server";

export type TeamGameMetric = {
  metric: string; label: string; value: number | null; unit: "count" | "%" | "avg" | "ratio" | "per9" | "decimal";
  opportunities?: number; opportunityLabel?: string;
  pending: boolean;
  pendingReason?: "missing" | "conflict";
  coverage?: { used: number; total: number };
};
export type TeamGameSummary = {
  players: number; entries: number; games: number; updatedAt: string | null;
  counts: TeamGameMetric[]; rates: TeamGameMetric[];
  hitMix?: { singles: number; extraBaseHits: number; homeRuns: number; hits: number };
};
type Counts = Map<string, number>;
type Ratio = { top: number; bottom: number };
const battingCounts = [["pa", "PA"], ["ab", "AB"], ["base_hit", "Hits"], ["pumps", "HR"], ["sb", "SB"], ["gdp", "GDP"]] as const;
const pitchingCounts = [["pitches", "Pitches"], ["strikes", "Strikes"], ["k", "K"], ["bb_outcome", "BB"], ["h", "Hits Allowed"], ["r", "Runs Allowed"]] as const;

/** Aggregate only one current source snapshot. Never average player rates or mix manual logs. */
export function teamGameSummary(stats: readonly SharedGameStat[], source: SharedGameStat["source"]): TeamGameSummary {
  const rows = stats.filter(row => row.source === source);
  const qpa = source === "qpa_fall_2026", groups = new Map<string, Counts>();
  let valid = new Set(rows.map(r => r.snapshot_id)).size <= 1 && new Set(rows.map(r => r.content_hash)).size <= 1;
  if(!qpa && rows.some(r=>r.event_id?.startsWith("fall-2026-week-")) && rows.some(r=>!r.event_id?.startsWith("fall-2026-week-")))valid=false;
  for (const row of rows) {
    const key = JSON.stringify([row.athlete_id, row.event_id]);
    const values = groups.get(key) ?? new Map<string, number>();
    if (values.has(row.metric) || !Number.isFinite(row.value) || row.value < 0 || (row.unit === "count" && !Number.isSafeInteger(row.value))) valid = false;
    values.set(row.metric, row.value); groups.set(key, values);
  }
  const entries = [...groups.values()].map(v => qpa ? qpaBattingCounts(v) : v);
  const count = (metric: string, label: string): TeamGameMetric => {
    const complete = valid && entries.length > 0 && entries.every(v => v.has(metric));
    return { metric, label, unit: "count", value: complete ? entries.reduce((n, v) => n + v.get(metric)!, 0) : null, pending: entries.length > 0 && !complete,
      ...(entries.length > 0 && !complete ? {pendingReason:valid?"missing" as const:"conflict" as const}: {}) };
  };
  const rate = (metric: string, label: string, unit: "%" | "avg" | "ratio" | "per9" | "decimal", keys: string[], ratio: (v: Counts) => Ratio | null, opportunityLabel: string, allowMultiple = false): TeamGameMetric => {
    const parts = valid ? entries.map(v => keys.every(k => v.has(k)) ? ratio(v) : null) : [null];
    const usable = parts.filter((p): p is Ratio => p !== null && p.top >= 0 && p.bottom >= 0 && (allowMultiple || p.top <= p.bottom));
    const complete = entries.length > 0 && usable.length === entries.length;
    const top = usable.reduce((n, p) => n + p.top, 0), bottom = usable.reduce((n, p) => n + p.bottom, 0);
    const knownConflict = qpa && entries.some(v=>{
      const has=(...fields:string[])=>fields.every(k=>v.has(k));
      const hitInputs=keys.some(k=>["base_hit","pumps","hh_extra_base_hit"].includes(k));
      return hitInputs && ((has("base_hit","ab")&&v.get("base_hit")!>v.get("ab")!) || (has("pumps","base_hit")&&v.get("pumps")!>v.get("base_hit")!) || (has("pumps","hh_extra_base_hit","base_hit")&&v.get("pumps")!+v.get("hh_extra_base_hit")!>v.get("base_hit")!))
        || keys.includes("punchies")&&hitInputs&&has("punchies","base_hit","ab")&&v.get("punchies")!+v.get("base_hit")!>v.get("ab")!;
    });
    const conflict = !valid || knownConflict || parts.some((p,i) => keys.every(k=>entries[i]?.has(k)) && (p===null || p.top<0 || p.bottom<0 || (!allowMultiple && p.top>p.bottom)));
    const calculable = !conflict && usable.length > 0 && bottom > 0;
    return { metric, label, unit, value: calculable ? top / bottom * (unit === "%" ? 100 : unit === "per9" ? 27 : 1) : null,
      ...(calculable ? { opportunities: bottom, opportunityLabel } : {}), pending: entries.length > 0 && !complete,
      ...(!complete && !conflict && usable.length ? { coverage:{used:usable.length,total:entries.length} } : {}),
      ...(entries.length > 0 && !complete ? {pendingReason:conflict?"conflict" as const:"missing" as const}: {}) };
  };
  const simple = (metric: string, label: string, top: string, bottom: string, unit: "%" | "avg", opportunity: string) => rate(metric, label, unit, [top, bottom], v => ({ top: v.get(top)!, bottom: v.get(bottom)! }), opportunity);
  const rates = qpa ? [
    simple("batting_avg", "AVG", "base_hit", "ab", "avg", "AB"),
    rate("batting_obp", "OBP", "avg", ["base_hit", "ab", "bb", "hbp", "sac_fly"], v => {
      const bottom = v.get("ab")! + v.get("bb")! + v.get("hbp")! + v.get("sac_fly")!;
      if (v.get("base_hit")! > v.get("ab")! || (v.has("pa") && bottom > v.get("pa")!)) return null;
      return { top: v.get("base_hit")! + v.get("bb")! + v.get("hbp")!, bottom };
    }, "OBP opportunities"),
    simple("qpa_pct", "QPA %", "qpa", "pa", "%", "PA"),
    rate("batting_hh_pct", "HH %", "%", ["hh_base_hit", "three_eight_hh", "hh_extra_base_hit", "pumps", "ab", "punchies", "sac_bunt"], v => ({
      top: v.get("hh_base_hit")! + v.get("three_eight_hh")! + v.get("hh_extra_base_hit")! + v.get("pumps")!,
      bottom: qpaSheetAB(v)! - v.get("punchies")! - v.get("sac_bunt")!,
    }), "HH opportunities"),
    simple("batting_bb_pct", "BB %", "bb", "pa", "%", "PA"),
    simple("batting_k_pct", "K %", "punchies", "pa", "%", "PA"),
    rate("batting_hr_pct", "HR %", "%", ["pumps", "pa"], v => v.has("base_hit") && v.get("pumps")! > v.get("base_hit")! ? null : { top: v.get("pumps")!, bottom: v.get("pa")! }, "PA"),
    rate("batting_sb_per_pa", "SB/PA", "ratio", ["sb", "pa"], v => ({top: v.get("sb")!, bottom: v.get("pa")!}), "PA", true),
    ...[["batting_est_slg","SLG"],["batting_est_iso","ISO"]].map(([metric,label])=>rate(metric,label,"avg",["base_hit","hh_extra_base_hit","pumps","ab"],v=>{const p=battingPowerParts(v,true);return p?{top:metric==="batting_est_slg"?p.bases:p.xbh+3*p.hr,bottom:p.ab}:null;},"AB",true)),
    rate("batting_est_wobacon","wOBAcon","avg",["base_hit","hh_extra_base_hit","pumps","ab","punchies","sac_fly"],v=>{const p=battingPowerParts(v,true);return p&&v.get("punchies")!+p.hits<=p.ab?{top:p.weightedHits,bottom:p.ab-v.get("punchies")!+v.get("sac_fly")!}:null;},"contacts",true),
   ] : [simple("strike_pct", "Strike %", "strikes", "pitches", "%", "pitches"), ...[["pitching_k9","K/9","k"],["pitching_bb9","BB/9","bb_outcome"],["pitching_r9","Runs/9","r"]].map(([metric,label,key])=>rate(metric,label,"per9",[key,"innings_outs"],v=>({top:v.get(key)!,bottom:v.get("innings_outs")!}),"outs",true)), ...[["weak_contact_pct","Weak Contact %","weak_contact"],["hard_contact_pct","Hard Contact %","hard_contact"]].map(([metric,label,key])=>rate(metric,label,"%",["weak_contact","hard_contact"],v=>({top:v.get(key)!,bottom:v.get("weak_contact")!+v.get("hard_contact")!}),"classified contacts")), rate("pitching_whip","WHIP","decimal",["h","bb_outcome","innings_outs"],v=>({top:3*(v.get("h")!+v.get("bb_outcome")!),bottom:v.get("innings_outs")!}),"outs",true),rate("pitching_k_bb","K/BB","decimal",["k","bb_outcome"],v=>({top:v.get("k")!,bottom:v.get("bb_outcome")!}),"walks",true),...[["pitching_fb_strike_pct","Fastball Family","fb","fb_k"],["pitching_breaking_strike_pct","Breaking Ball","bb_pitch_family","bb_pitch_family_k"],["pitching_ch_strike_pct","Changeup","ch","ch_k"]].map(([metric,label,pitches,strikes])=>rate(metric,label,"%",[pitches,strikes],v=>({top:v.get(strikes)!,bottom:v.get(pitches)!}),"pitches")),];
  return { players: new Set(rows.map(r => r.athlete_id)).size, entries: entries.length,
    games: qpa ? 0 : new Set(rows.map(r => r.event_id)).size,
    updatedAt: rows.length ? rows.reduce((latest, r) => r.fetched_at > latest ? r.fetched_at : latest, rows[0].fetched_at) : null,
    counts: (qpa ? battingCounts : [...pitchingCounts,["innings_outs","Innings Pitched"] as const]).map(([metric, label]) => count(metric, label)), rates,
    ...(qpa && valid && entries.length>0 && entries.every(v=>battingPowerParts(v,true)) ? {hitMix:entries.reduce((mix,v)=>{const p=battingPowerParts(v,true)!;return {singles:mix.singles+p.hits-p.xbh-p.hr,extraBaseHits:mix.extraBaseHits+p.xbh,homeRuns:mix.homeRuns+p.hr,hits:mix.hits+p.hits};},{singles:0,extraBaseHits:0,homeRuns:0,hits:0})}: {}) };
}

export function formatTeamGameMetric(metric: TeamGameMetric): string {
  if (metric.value === null) return "—";
  if (metric.unit === "decimal") return metric.value.toFixed(2);
  if (metric.unit === "per9") return metric.value.toFixed(2);
  if (metric.unit === "%") return `${metric.value.toFixed(1)}%`;
  if (metric.unit === "ratio") return metric.value.toFixed(3);
  if (metric.unit === "avg") return metric.value.toFixed(3).replace(/^0\./, ".");
  return metric.value.toLocaleString("en-US");
}

export function teamGameMetricStatus(metric: TeamGameMetric): string {
  return metric.coverage && metric.value !== null ? `Recorded subset · ${metric.coverage.used} of ${metric.coverage.total} lines` : metric.pendingReason === "missing" ? "Awaiting counts" : "Counts need review";
}
