import { describe, expect, it } from "vitest";
import type { Measurement } from "@/lib/imports/engine";
import { prepareReviewedPerformanceRows, reviewPerformanceImport } from "@/lib/performance-import";

const hash="a".repeat(64);
function measurement(metric="Weight",unit="lb",column=0):Measurement {
  return {id:`observation:${JSON.stringify([hash,"RENPHO report · Page 1",2,column])}`,athlete_code:"SYN-001",measured_at:"2026-08-20",source:"RENPHO",metric,value:50,unit,
    source_file:"fictional-report.png",source_sheet:"RENPHO report · Page 1",source_row:2,file_hash:hash};
}
describe("reviewed shared measurement normalization",()=>{
  it("preserves every supported raw RENPHO report field and exact provenance",()=>{
    const pairs=[['Weight','lb'],['Body Fat Mass','lb'],['Bone Mass','lb'],['Protein Mass','lb'],['Body Water Mass','lb'],['Muscle Mass','lb'],['Skeletal Muscle Mass','lb'],['BMI','kg/m²'],['Body Fat Percentage','%'],['BMR','kcal'],['Fat-Free Mass','lb'],['Subcutaneous Fat','%'],['Visceral Fat','index'],['Skeletal Muscle Index','kg/m²'],['Metabolic Age','years'],['Waist-to-Hip Ratio','ratio']];
    const input=pairs.map(([metric,unit],column)=>measurement(metric,unit,column));
    const result=prepareReviewedPerformanceRows(input);
    expect(result).toHaveLength(16);
    expect(new Set(result.map(row=>row.metric_key)).size).toBe(16);
    expect(result.map(row=>row.observation_id)).toEqual(input.map(row=>row.id));
    expect(result.every(row=>row.athlete_code==='SYN-001' && row.file_hash===hash && row.source_file==='fictional-report.png')).toBe(true);
    expect(result.find(row=>row.metric_key==='body_fat_pct')).toMatchObject({value:50,unit:'%'});
  });
  it("uses explicit metric/unit aliases without numerical conversion",()=>{
    const rows=prepareReviewedPerformanceRows([measurement('Max EV','MPH',0),measurement('Home to 1st','seconds',1),measurement('Weight','lbs',2)]);
    expect(rows.map(row=>[row.metric_key,row.unit,row.value])).toEqual([['max_exit_velocity','mph',50],['home_to_first','s',50],['weight','lb',50]]);
  });
  it("reports unsupported metric exclusions separately from invalid recognized units",()=>{
    const review=reviewPerformanceImport([measurement(),measurement('Unmapped vendor score','points',1),measurement('Weight','bananas',2)]);
    expect(review.rows).toHaveLength(1);expect(review.excluded).toEqual([{index:1,metric:'Unmapped vendor score',unit:'points',reason:'This metric is not in the shared performance catalog.'}]);
    expect(review.errors).toEqual([expect.objectContaining({index:2})]);expect(review.canApply).toBe(false);
    const supported=reviewPerformanceImport([measurement(),measurement('Unmapped vendor score','points',1)]);
    expect(supported.canApply).toBe(true);expect(supported.excluded).toHaveLength(1);
    expect(()=>prepareReviewedPerformanceRows([measurement('Unmapped vendor score','points')])).toThrow();
  });
  it("blocks malformed provenance, duplicate positions, invalid dates/values and positive-only zero",()=>{
    for(const changes of [{measured_at:'2026-02-30'},{value:NaN},{value:-1},{value:0},{id:'guessed observation'},{source_row:4},{athlete_code:'unknown code'}]) expect(()=>prepareReviewedPerformanceRows([{...measurement(),...changes}])).toThrow();
    const a=measurement(),b={...measurement(),id:'observation:'+JSON.stringify([hash,'RENPHO report · Page 1',2,0],null,1)};
    expect(()=>prepareReviewedPerformanceRows([a,b])).toThrow();
    expect(()=>prepareReviewedPerformanceRows([{...measurement('Body Fat Percentage','%'),value:101}])).toThrow();
  });
  it("requires a smaller explicitly reviewed batch above 500 supported observations",()=>{
    const review=reviewPerformanceImport(Array.from({length:501},(_,column)=>measurement('Bat Speed','mph',column)));
    expect(review.canApply).toBe(false);expect(review.errors).toEqual([expect.objectContaining({index:null,message:'Review 1–500 measurements in one shared import.'})]);
  });
  it("serializes only the exact reviewed Measurement fields when backups contain extra report data",()=>{
    const original={...measurement(),report_text:'FICTIONAL_PRIVATE_OCR',image:'FICTIONAL_PRIVATE_IMAGE',ocr:{text:'FICTIONAL_PRIVATE_NESTED'},batch_id:'local-only-batch'};
    const review=reviewPerformanceImport([original]);
    expect(review.canApply).toBe(true);
    expect(review.candidateMeasurements).toEqual([measurement()]);
    expect(review.candidateMeasurements[0]).not.toBe(original);
    expect(Object.keys(review.candidateMeasurements[0]).sort()).toEqual(['athlete_code','file_hash','id','measured_at','metric','source','source_file','source_row','source_sheet','unit','value']);
    const payload=JSON.stringify(review.candidateMeasurements);
    for(const excluded of ['FICTIONAL_PRIVATE','report_text','image','ocr','batch_id','local-only-batch']) expect(payload).not.toContain(excluded);
    original.report_text='CHANGED_EXTRA';
    expect(JSON.stringify(review.candidateMeasurements)).not.toContain('CHANGED_EXTRA');
  });
});
