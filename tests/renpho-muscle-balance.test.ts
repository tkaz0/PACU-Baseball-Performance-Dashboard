import { describe, expect, it } from 'vitest';
import { parseRenphoRegions, withReviewedRenphoMuscleBalance, type RenphoRegions } from '@/lib/imports/renpho';
import { previewRenphoMeasurements } from '@/lib/imports/renpho-preview';
import { prepareReviewedPerformanceRows } from '@/lib/performance-import';
import { getRenphoReports } from '@/lib/renpho-charts';
import { getRenphoMuscleBalance } from '@/lib/renpho-muscle-balance';
import { getPlayerPerformance } from '@/lib/player-performance';
import { getPlayerProfileLayout } from '@/lib/player-profile-layout';
import { leaderboardMetrics } from '@/lib/leaderboards';
import { RENPHO_SEGMENTS } from '@/lib/renpho-segments';
import type { RosterAthlete } from '@/lib/types';
const fixture=():RenphoRegions=>({title:'Body Composition Analysis Report',header:'ID: FICTIONAL-BALANCE | Test Date: Oct 2, 2026 at 1:02:03PM',compositionHeader:'Measurement(lb)',compositionRows:['Weight','Body Fat Mass','Bone Mass','Protein Mass','Body Water Mass','Muscle Mass','Skeletal Muscle Mass'].map((label,i)=>({label,measurement:String(i+1),line:i+1})),assessment:'',indicators:'',muscleBalanceTitle:'Muscle Balance',muscleBalance:Object.fromEntries(RENPHO_SEGMENTS.map(s=>[s.key,`${s.regionLabel}\n${s.key.startsWith('right')?'High • ':''}10.4 lb${s.key.startsWith('right')?'':' High'}\n118.6 %\n8.8 lb`]))});
const roster:RosterAthlete[]=[{id:'SYN-001',athlete_code:'SYN-001',first_name:'Fictional',last_name:'Balance',preferred_name:null,pacific_email:null,profile_photo_url:null,created_at:'',updated_at:'',athlete_seasons:[]}];
function preview(parsed=parseRenphoRegions(fixture())){return previewRenphoMeasurements({parsed,candidates:parsed.candidateReadings,athleteCode:'SYN-001',measuredAt:parsed.reportedDate!,roster,existing:[],fileHash:'a'.repeat(64),fileName:'fictional-balance.png'});}
function balance(left=9,right=10){const readings=preview().candidateMeasurements.map(r=>({...r,value:r.metric==='Left Arm Muscle Mass'?left:r.metric==='Right Arm Muscle Mass'?right:r.value}));return {readings, report:getRenphoReports(readings,[],'SYN-001')[0]};}
describe('RENPHO muscle balance',()=>{
 it('reads each isolated actual mass, never the reference percentage or standard mass',()=>{
  const p=parseRenphoRegions(fixture());
  for(const s of RENPHO_SEGMENTS)expect(p.candidateReadings.find(r=>r.key===s.key)).toMatchObject({value:10.4,unit:'lb',metricColumn:s.column,line:5001+s.column-23});
  expect(prepareReviewedPerformanceRows(preview(p).candidateMeasurements).filter(r=>r.metric_key.endsWith('_muscle_mass'))).toHaveLength(6);
 });
 it.each(['Left Arm\n1O.4 lb High\n118.6 %\n8.8 lb','Left Arm\n118.6 %\n8.8 lb','Right Arm\n10.4 lb','Left Arm\n10.4 8.8 lb','Left Arm\n10.4\n118.6 %\n8.8 lb'])('omits ambiguous mass without blocking valid fields: %s',text=>{
  const f=fixture();f.muscleBalance!.left_arm_muscle_mass=text;
  const p=parseRenphoRegions(f);expect(p.candidateReadings.some(r=>r.key==='left_arm_muscle_mass')).toBe(false);expect(preview(p).canApply).toBe(true);
 });
 it('requires the known portrait and muscle balance title',()=>{
  for(const f of [{...fixture(),title:'Unknown'},{...fixture(),muscleBalanceTitle:'Segmental Fat Analysis'}])expect(parseRenphoRegions(f).candidateReadings.some(r=>r.region==='muscle-balance')).toBe(false);
 });
 it('preserves old observation positions and supports reviewed missing fields',()=>{
  const old=parseRenphoRegions({...fixture(),muscleBalance:undefined,muscleBalanceTitle:undefined});
  expect(preview().candidateMeasurements.filter(r=>r.source_row<5001)).toEqual(preview(old).candidateMeasurements);
  const manual=withReviewedRenphoMuscleBalance(old,{left_arm_muscle_mass:'9.2'},'lb');
  expect(manual.candidateReadings.at(-1)).toMatchObject({value:9.2,line:5001,metricColumn:23,unitEvidence:'manual-report'});
  expect(preview(manual).canApply).toBe(true);
  expect(()=>withReviewedRenphoMuscleBalance(old,{left_arm_muscle_mass:'9.2'},'')).toThrow();
  expect(()=>withReviewedRenphoMuscleBalance(manual,{left_arm_muscle_mass:'9.3'},'lb')).toThrow();
 });
 it.each([[9,10,10,true],[10,9,10,true],[9.01,10,9.9,false],[10,10,0,false]])('uses the larger side as denominator and flags at the exact threshold', (left,right,difference,review)=>{
  const pair=getRenphoMuscleBalance(balance(left,right).report).pairs[0];expect(pair.difference).toBeCloseTo(difference);expect(pair.review).toBe(review);
 });
 it('never compares across reports, players, dates, units, duplicates or invalid numbers',()=>{
  const {report}=balance();
  for(const change of [{file_hash:'b'.repeat(64)},{athlete_code:'SYN-002'},{measured_at:'2026-10-03'},{unit:'kg'},{value:0},{value:NaN}]) {
   const altered={...report,readings:report.readings.map(r=>r.metric==='Left Arm Muscle Mass'?{...r,...change}:r)};
   expect(getRenphoMuscleBalance(altered).pairs[0]).toMatchObject({difference:null,review:false});
  }
  const duplicate=report.readings.find(r=>r.metric==='Left Arm Muscle Mass')!;
  expect(getRenphoMuscleBalance({...report,readings:[...report.readings,{...duplicate,id:'duplicate'}]}).pairs[0].difference).toBeNull();
  expect(getRenphoMuscleBalance({...report,readings:report.readings.filter(r=>r.metric!=='Left Arm Muscle Mass')}).pairs[0].difference).toBeNull();
 });
 it('promotes skeletal mass separately from total muscle mass in profiles and leaderboards',()=>{
  const performance=getPlayerPerformance({readings:preview().candidateMeasurements,athleteCode:'SYN-001'});
  expect(getPlayerProfileLayout(performance).additionalBody.find(c=>c.metric.key==='skeletal_muscle_mass')?.latest?.value).toBe(7);
  expect(getPlayerProfileLayout(performance).additionalBody.find(c=>c.metric.key==='muscle_mass')?.latest?.value).toBe(6);
  expect(leaderboardMetrics('physicality').some(m=>m.key==='skeletal_muscle_mass')).toBe(true);
 });
});
