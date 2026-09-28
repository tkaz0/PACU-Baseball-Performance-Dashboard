import { describe, expect, it } from 'vitest';
import { parseLegacyPitchReview, verifyLegacyPitchFile, validReclassifyPitchRequest, type LegacyPitchReview } from '@/lib/legacy-pitch-reclassification';
import { CLASSIFIED_METRICS } from '@/lib/imports/classified-pitch-results';
import { type FullSwingSession } from '@/lib/imports/full-swing-session';
const hash='a'.repeat(64);
const review:LegacyPitchReview={fileHash:hash,sourceFile:'fictional.csv',date:'2026-09-11',source:'Full Swing · Intrasquad · Fastball',currentType:'Fastball',measurementCount:7,summaryRow:2,assignmentVersion:1,fingerprint:'b'.repeat(64),metrics:CLASSIFIED_METRICS.map((m,i)=>({metricKey:m.key,unit:m.unit,value:[82,81,2100,2050,2,2,2][i],sourceColumn:i}))};
const session={date:'2026-09-11',mode:'Live at Bat',pitches:[{identity:'Fictional Pitcher',sourceRow:2,pitchNumber:1,velocity:80,spin:2000},{identity:'Fictional Pitcher',sourceRow:3,pitchNumber:2,velocity:82,spin:2100},{identity:'Fictional Other',sourceRow:4,pitchNumber:3,velocity:90,spin:2400}]} as FullSwingSession;
const labels={version:1,assignments:[{sourceRow:2,pitchType:'Fastball' as const},{sourceRow:3,pitchType:'Fastball' as const},{sourceRow:4,pitchType:'Fastball' as const}]};
describe('reviewed legacy pitch correction',()=>{
 it('matches every original measurement and passes only this pitcher’s original rows',()=>{expect(verifyLegacyPitchFile(review,hash,session,labels,'Fictional Pitcher')).toEqual([2,3]);expect(labels.assignments[2].pitchType).toBe('Fastball');});
 it('rejects a different file, player, date or changed labels before a write',()=>{
  expect(()=>verifyLegacyPitchFile(review,'c'.repeat(64),session,labels,'Fictional Pitcher')).toThrow();
  expect(()=>verifyLegacyPitchFile(review,hash,session,labels,'Fictional Other')).toThrow();
  expect(()=>verifyLegacyPitchFile(review,hash,{...session,date:'2026-09-12'},labels,'Fictional Pitcher')).toThrow();
  expect(()=>verifyLegacyPitchFile(review,hash,session,{...labels,version:2},'Fictional Pitcher')).toThrow();
 });
 it('checks average/max velocity, spin and each sample count independently',()=>{for(let i=0;i<7;i++){const changed=structuredClone(review);changed.metrics[i].value+=1;expect(()=>verifyLegacyPitchFile(changed,hash,session,labels,'Fictional Pitcher')).toThrow();}});
 it('rejects incomplete, duplicate or invalid saved groups',()=>{expect(parseLegacyPitchReview([review])).toEqual([review]);expect(()=>parseLegacyPitchReview([{...review,metrics:review.metrics.slice(1)}])).toThrow();expect(()=>parseLegacyPitchReview([review,review])).toThrow();expect(()=>parseLegacyPitchReview([{...review,summaryRow:1}])).toThrow();});
 it('requires exact bounded request fields and unique original rows',()=>{const request={requestId:'11111111-1111-4111-8111-111111111111',athleteId:'22222222-2222-4222-8222-222222222222',fileHash:hash,fingerprint:'b'.repeat(64),sourceRows:[2,3]};expect(validReclassifyPitchRequest(request)).toBe(true);expect(validReclassifyPitchRequest({...request,sourceRows:[2,2]})).toBe(false);expect(validReclassifyPitchRequest({...request,sourceRows:[1]})).toBe(false);expect(validReclassifyPitchRequest({...request,target:'Slider'})).toBe(false);});
});
