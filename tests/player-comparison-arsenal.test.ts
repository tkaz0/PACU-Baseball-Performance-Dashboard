import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { comparePitchArsenals, withoutCoveredPitchVelocity } from "@/lib/player-comparison-arsenal";
import { PitchArsenalComparison } from "@/components/pitch-arsenal-comparison";
import type { CoachingData } from "@/lib/coaching-tools";
import { comparisonArsenalPlayerA as a, comparisonArsenalPlayerB as b, fictionalComparisonPitch as pitch, fictionalComparisonArsenalData } from "./fixtures/comparison-arsenal";
const data=(first=[pitch()],second=[pitch({averageVelocity:83,maxVelocity:85,averageSpin:1900,maxSpin:2100})]):CoachingData=>({players:[a,b],readings:[],games:[],arsenals:[{athleteId:a.id,pitches:first},{athleteId:b.id,pitches:second}]});
const compare=(d=data(),gap=30)=>comparePitchArsenals(d,a.id,b.id,"2026-09-27",gap);

describe("full arsenal comparison",()=>{
 it("includes the union of both pitchers' pitches with all four metrics and visible missing values",()=>{
  const rows=compare(fictionalComparisonArsenalData);expect(rows).toHaveLength(5);expect(rows.find(row=>row.pitchType==="Curveball")!.metrics.every(metric=>metric.first&&!metric.second)).toBe(true);expect(rows.find(row=>row.pitchType==="Changeup")!.metrics.every(metric=>!metric.first&&metric.second)).toBe(true);expect(rows.every(row=>row.metrics.map(metric=>metric.key).join(",")==="classified_avg_velocity,classified_max_velocity,classified_avg_spin,classified_max_spin")).toBe(true);
 });
 it("keeps exact sources, game contexts, and pitch types separate even when display categories are both In-Game",()=>{
  const rows=compare(data([pitch(),pitch({category:"Game",source:"Full Swing · Game · Fastball"})],[pitch({category:"Practice",source:"Full Swing · Practice · Fastball"})]));expect(rows.map(row=>row.category)).toEqual(["Game","Intrasquad","Practice"]);expect(rows.every(row=>row.metrics.every(metric=>metric.lead===null))).toBe(true);
 });
 it("compares Fall velocity summaries using full precision but never calls higher spin the winner",()=>{
  const [row]=compare();expect(row.metrics[0].first?.value).toBe(81.567);expect(row.metrics[0].lead).toBe("b");expect(row.metrics[1].lead).toBe("a");expect(row.metrics[2].lead).toBeNull();expect(row.metrics[3].lead).toBeNull();expect(row.metrics[2].note).toBe("Spin is descriptive");
 });
 it("shows distinct average and maximum denominators beside the exact value dates",()=>{
  const [row]=compare(data([pitch({spinAverageFirstDate:"2026-09-11",spinAverageLastDate:"2026-09-11",maxSpinDate:"2026-09-11"})]));expect(row.metrics[0].first).toMatchObject({count:36,firstDate:"2026-09-11",lastDate:"2026-09-23",basis:"Fall average"});expect(row.metrics[1].first).toMatchObject({count:31,firstDate:"2026-09-11",lastDate:"2026-09-11",basis:"Fall best"});expect(row.metrics[2].first).toMatchObject({count:34,firstDate:"2026-09-11",lastDate:"2026-09-11"});expect(row.metrics[3].first?.count).toBe(29);
 });
 it("never substitutes average counts for unavailable maximum counts and keeps average sample warnings",()=>{
  const comparisons=compare(data([pitch({maxVelocityReadings:undefined,maxSpinReadings:null,velocityReadings:null})],[]));
  expect(comparisons[0].metrics[1].first?.count).toBeNull();expect(comparisons[0].metrics[3].first?.count).toBeNull();
  const html=renderToStaticMarkup(createElement(PitchArsenalComparison,{comparisons,first:a.name,second:b.name}));
  expect(html.match(/Reading count unavailable/g)).toHaveLength(1);
  expect(html).toContain("34 spin readings");
 });
 it("withholds an average leader for mixed bases or widely separated latest sessions, without limiting Fall maxima",()=>{
  const latest=pitch({velocityBasis:"latest",velocityAverageFirstDate:"2026-09-01",velocityAverageLastDate:"2026-09-01"});const mixed=compare(data([latest],[pitch()]))[0];expect(mixed.metrics[0].lead).toBeNull();expect(mixed.metrics[0].note).toBe("Different averaging periods");
  const second=pitch({averageVelocity:84,velocityBasis:"latest",velocityAverageFirstDate:"2026-09-23",velocityAverageLastDate:"2026-09-23",maxVelocity:87,maxVelocityDate:"2026-09-23"});const near=compare(data([latest],[second]),30)[0],apart=compare(data([latest],[second]),7)[0];expect(near.metrics[0].lead).toBe("b");expect(apart.metrics[0].lead).toBeNull();expect(apart.metrics[0].note).toBe("Sessions outside selected window");expect(apart.metrics[1].lead).toBe("b");
 });
 it("keeps pitcher-only role gates, rejects same-player comparisons, and withholds ambiguous or malformed summaries",()=>{
  const d=data();d.players[0]={...a,position:"SS",playerType:"position"};const result=compare(d)[0];expect(result.eligibleA).toBe(false);expect(result.metrics.every(metric=>metric.first===null)).toBe(true);expect(comparePitchArsenals(data(),a.id,a.id,"2026-09-27")).toEqual([]);
  const duplicate=compare(data([pitch(),pitch()]));expect(duplicate[0].reviewA).toBe(true);expect(duplicate[0].metrics.every(metric=>metric.first===null)).toBe(true);
  const malformed=compare(data([pitch({category:"Practice"})]));expect(malformed[0].metrics.every(metric=>metric.first===null)).toBe(true);
  const future=compare(data([pitch({maxVelocityDate:"2026-09-30",velocityAverageLastDate:"2026-09-30"})]));expect(future[0].metrics[0].first).toBeNull();expect(future[0].metrics[1].first).toBeNull();
 });
 it("renders every pitch visibly with one decimal, dates, reading counts, and labeled information controls",()=>{
  const comparisons=compare(fictionalComparisonArsenalData),html=renderToStaticMarkup(createElement(PitchArsenalComparison,{comparisons,first:a.name,second:b.name}));
  for(const label of ["Fastball","Slider","Curveball","Changeup","Average Velocity","Max Velocity","Average Spin","Max Spin","In-Game · Intrasquad","Practice","81.6 mph","2001.2 rpm","36 velocity readings","34 spin readings","Latest session","Not recorded"])expect(html).toContain(label);
  expect(html).not.toContain("81.567");expect(html).not.toContain("file_hash");expect(html).not.toContain("source_row");expect(html).toContain('aria-label="About Fastball Average Velocity"');expect(html).not.toContain("<details");
 });
});


describe("comparison velocity fallback",()=>{
 const row=(metric="avg_pitch_velocity",source="Full Swing · Intrasquad",first:unknown={value:80},second:unknown={value:82})=>({metric,source,first,second,reviewA:false,reviewB:false});
 it("replaces only broad velocity rows covered on every recorded side, preserving manual, field and unmatched sources",()=>{
  const rows=[row(),row("max_pitch_velocity"),row("avg_pitch_velocity","Manual Testing"),row("max_pitch_velocity","Radar Gun"),row("avg_pitch_velocity","Full Swing · Practice"),row("avg_pitch_velocity","Full Swing · Game"),row("infield_velocity"),row("outfield_velocity"),row("avg_fastball_spin")];
  expect(withoutCoveredPitchVelocity(rows,compare())).toEqual(rows.slice(2));
 });
 it("keeps the other player's broad reading when no classified counterpart is saved",()=>{
  const generic=row();expect(withoutCoveredPitchVelocity([generic],compare(data([pitch()],[])))).toEqual([generic]);
  const single=row("avg_pitch_velocity","Full Swing · Intrasquad",{value:80},null);expect(withoutCoveredPitchVelocity([single],compare(data([pitch()],[])))).toEqual([]);
 });
 it("requires the specific average/max family and never drops unresolved test conflicts",()=>{
  const mean=row(),maximum=row("max_pitch_velocity");const maxOnly=compare(data([pitch({averageVelocity:null})],[pitch({averageVelocity:null})]));
  expect(withoutCoveredPitchVelocity([mean,maximum],maxOnly)).toEqual([mean]);
  const conflict={...mean,first:null,reviewA:true};expect(withoutCoveredPitchVelocity([conflict],compare())).toEqual([conflict]);
 });
 it("preserves legacy Full Swing Pitching summaries without an exact classified source counterpart",()=>{
  const legacy=row("avg_pitch_velocity","Full Swing · Pitching"),practice=pitch({category:"Practice",source:"Full Swing · Practice · Fastball"});
  expect(withoutCoveredPitchVelocity([legacy],compare())).toEqual([legacy]);expect(withoutCoveredPitchVelocity([legacy],compare(data([practice],[practice])))).toEqual([legacy]);
 });
});
