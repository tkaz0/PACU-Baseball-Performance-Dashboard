import { expect, it } from "vitest";
import { contactPitchSplits } from "@/lib/contact-pitch-splits";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
// Fictional readings only.
const contact = (ev: number, extra: Partial<SavedContact> = {}): SavedContact => ({fileHash:"a".repeat(64),sourceRow:2,pitchNumber:1,sourceFile:"fictional.csv",playedOn:"2026-09-11",category:"intrasquad",exitVelocity:ev,launchAngle:20,direction:0,distance:200,pitchType:"Slider",...extra});
it("pools contact rows, not session means, with exact thresholds and separate quality coverage",()=>{
 const [row]=contactPitchSplits([contact(90,{squaredUp:.9,potentialExitVelocity:100}),contact(80),contact(70,{launchAngle:33})]);
 expect(row).toMatchObject({count:3,avgEv:80,maxEv:90});
 expect(row.quality.hardHitPct).toBeCloseTo(100/3);expect(row.quality.sweetSpotPct).toBeCloseTo(200/3);
 expect(row.squared).toMatchObject({count:1,total:3,avgSquaredUp:90});
});
it("keeps game, intrasquad and practice apart, including unlabeled and legacy pitches",()=>{
 const rows=contactPitchSplits([contact(90),contact(80,{category:"practice"}),contact(70,{category:"game"}),contact(60,{pitchType:null}),contact(65,{pitchType:"Fastball"})]);
 expect(rows).toHaveLength(4);expect(rows.find(r=>r.pitchType===null)).toMatchObject({count:2,avgEv:62.5});
 expect(rows.filter(r=>r.pitchType)).toHaveLength(3);
 expect(rows.reduce((sum,row)=>sum+row.count,0)).toBe(5);
});
it("follows the supplied selection, retaining likely fouls in All Contact without refiltering",()=>{
 expect(contactPitchSplits([contact(60,{direction:60})])[0].quality.count).toBe(1);
 expect(contactPitchSplits([])).toEqual([]);
});
