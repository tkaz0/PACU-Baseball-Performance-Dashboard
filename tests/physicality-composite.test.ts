import { describe, expect, it } from "vitest";
import { physicalityComposite, type PhysicalityPanel } from "@/lib/physicality-composite";

function panels(n = 5): PhysicalityPanel[] {
  return ([['height','in'], ['muscle_mass','lb'], ['body_fat_pct','%']] as const).map(([metricKey,unit]) => ({ comparison: { metricKey, unit, source:'renpho', period:'fall_2026', athleteCount:n }, rows:Array.from({length:n},(_,i)=>({rank:i+1,athleteCode:`PAC-${String(i+1).padStart(4,'0')}`,name:`Fictional Player ${i+1}`,jerseyNumber:null,position:null,profileId:null,value:metricKey==='body_fat_pct'?20-i:60+i,measuredAt:'2026-09-06',source:'renpho',derived:false})) }));
}
describe('physicality composite v1',()=>{
  it('equally weights three directed percentiles and preserves profile permissions',()=>{
    const result=physicalityComposite(panels());
    expect(result.rows.map(r=>r.value)).toEqual([100,75,50,25,0]);
    expect(result.rows.map(r=>r.rank)).toEqual([1,2,3,4,5]);
    expect(result.rows.every(r=>r.profileId===null)).toBe(true);
    expect(result.rows[0].components).toEqual({height:100,muscle_mass:100,body_fat_pct:100});
  });
  it('uses midpoint ties and competition ranks',()=>{
    const p=panels();p.forEach(x=>x.rows.forEach(r=>r.value=50));
    expect(physicalityComposite(p).rows.map(r=>[r.rank,r.value])).toEqual(Array(5).fill([1,50]));
  });
  it('does not score incomplete players or fill zeroes',()=>{
    const p=panels(6);p[1].rows.pop();const result=physicalityComposite(p);
    expect(result.sampleSize).toBe(5);expect(result.excludedCount).toBe(1);expect(result.rows).toHaveLength(5);
  });
  it('requires five complete players, not five readings per separate metric',()=>{
    const p=panels();p[2].rows[0].athleteCode='PAC-0099';
    expect(physicalityComposite(p).rows).toEqual([]);
    expect(physicalityComposite(panels(4)).rows).toEqual([]);
  });
  it('rejects mismatched dates and nonfinite values',()=>{
    const p=panels(7);p[1].rows[0].measuredAt='2026-09-07';p[2].rows[1].value=NaN;
    const result=physicalityComposite(p);expect(result.rows).toHaveLength(5);expect(result.excludedCount).toBe(2);
  });
  it('never pools periods or sources',()=>{
    const p=panels();p[2].comparison.source='other device';expect(physicalityComposite(p).rows).toEqual([]);
    p[2].comparison.source='renpho';p[2].comparison.period='summer_2026';expect(physicalityComposite(p).rows).toEqual([]);
  });
  it('keeps unit partitions separate and selects the complete cohort deterministically',()=>{
    const p=panels(6),other=structuredClone(p[0]);other.comparison.unit='cm';other.rows=other.rows.slice(0,5);other.rows.forEach(r=>r.value*=2.54);
    expect(physicalityComposite([...p,other]).heightUnit).toBe('in');
    expect(physicalityComposite([...p,other].reverse())).toEqual(physicalityComposite([...p,other]));
  });
  it('does not mutate source rows',()=>{
    const p=panels(),before=structuredClone(p);physicalityComposite(p);expect(p).toEqual(before);
  });
});
