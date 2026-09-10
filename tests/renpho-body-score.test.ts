import { describe, expect, it } from 'vitest';
import { parseRenphoRegions, withReviewedRenphoBodyScore, type RenphoRegions } from '@/lib/imports/renpho';
import { previewRenphoMeasurements } from '@/lib/imports/renpho-preview';
import { prepareReviewedPerformanceRows } from '@/lib/performance-import';
import { getPlayerPerformance } from '@/lib/player-performance';
import type { RosterAthlete } from '@/lib/types';
const fixture=(bodyScore?:string):RenphoRegions=>({title:'Body Composition Analysis Report',header:'ID: FICTIONAL-SCORE | Test Date: Oct 2, 2026 at 1:02:03PM',compositionHeader:'Measurement(lb)',compositionRows:['Weight','Body Fat Mass','Bone Mass','Protein Mass','Body Water Mass','Muscle Mass','Skeletal Muscle Mass'].map((label,i)=>({label,measurement:String(i+1),line:i+1})),assessment:'',indicators:'',bodyScore});
const roster:RosterAthlete[]=[{id:'SYN-001',athlete_code:'SYN-001',first_name:'Fictional',last_name:'Score',preferred_name:null,pacific_email:null,profile_photo_url:null,created_at:'',updated_at:'',athlete_seasons:[]}];
function preview(bodyScore?:string){const parsed=parseRenphoRegions(fixture(bodyScore));return previewRenphoMeasurements({parsed,candidates:parsed.candidateReadings,athleteCode:'SYN-001',measuredAt:parsed.reportedDate!,roster,existing:[],fileHash:'a'.repeat(64),fileName:'fictional-score.png'});}
describe('printed RENPHO Body Score',()=>{
 it.each([['Body Score\n84/100 Points',84],['Body Score 103 / 100 Points',103],['Body Score 0/100 Points',0]])('keeps the numerator exactly, including scores above 100: %s',(printed,value)=>{
  const p=parseRenphoRegions(fixture(printed));expect(p.candidateReadings.find(r=>r.key==='body_score')).toMatchObject({value,unit:'points',metricColumn:22,line:4001,region:'score'});
 });
 it.each(['Body Score 84','Body Score 8O/100 Points','Body Score 84/90 Points','Body Score 84/100 Points 88/100 Points','Target Score 84/100','Body Score -1/100'])('omits ambiguous score without blocking other readings: %s',printed=>{
  const p=parseRenphoRegions(fixture(printed));expect(p.candidateReadings.some(r=>r.key==='body_score')).toBe(false);expect(p.issues).toContainEqual(expect.objectContaining({code:'body_score_unreadable',severity:'review'}));expect(preview(printed).canApply).toBe(true);
 });
 it('never invents a score from composition data or an unknown layout',()=>{
  expect(parseRenphoRegions(fixture()).candidateReadings.some(r=>r.key==='body_score')).toBe(false);
  expect(parseRenphoRegions({...fixture('Body Score 84/100'),title:'Unknown'}).candidateReadings.some(r=>r.key==='body_score')).toBe(false);
 });
 it('adds an independent stable observation without changing existing positions',()=>{
  const previous=preview(),current=preview('Body Score 84/100 Points');
  expect(current.candidateMeasurements.filter(r=>r.metric!=='RENPHO Body Score')).toEqual(previous.candidateMeasurements);
  const canonical=prepareReviewedPerformanceRows(current.candidateMeasurements);expect(canonical.find(r=>r.metric_key==='body_score')).toMatchObject({value:84,unit:'points',source_row:4001});
  expect(getPlayerPerformance({readings:current.candidateMeasurements,athleteCode:'SYN-001'}).body.find(r=>r.metric.key==='body_score')?.latest?.value).toBe(84);
 });
 it('accepts an explicit missing-score transcription without changing other observations',()=>{
  const original=parseRenphoRegions(fixture('Body Score O91 100 Points'));
  const reviewed=withReviewedRenphoBodyScore(original,'91');
  expect(reviewed.candidateReadings.slice(0,-1)).toEqual(original.candidateReadings);
  expect(reviewed.candidateReadings.at(-1)).toMatchObject({value:91,unitEvidence:'manual-report',line:4001,metricColumn:22});
  expect(withReviewedRenphoBodyScore(original,'')).toBe(original);
  const result=previewRenphoMeasurements({parsed:reviewed,candidates:reviewed.candidateReadings,athleteCode:'SYN-001',measuredAt:reviewed.reportedDate!,roster,existing:[],fileHash:'a'.repeat(64),fileName:'fictional-score.png'});
  expect(result.canApply).toBe(true);expect(prepareReviewedPerformanceRows(result.candidateMeasurements).find(row=>row.metric_key==='body_score')?.value).toBe(91);
  for(const text of ['O91','-1','91/100','9 1','001'])expect(()=>withReviewedRenphoBodyScore(original,text)).toThrow();
  expect(()=>withReviewedRenphoBodyScore(parseRenphoRegions(fixture('Body Score 84/100')),'91')).toThrow();
  expect(()=>withReviewedRenphoBodyScore({...original,recognizedLayout:false},'91')).toThrow();
 });

});
