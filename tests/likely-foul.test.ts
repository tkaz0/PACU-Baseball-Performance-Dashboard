import {expect,it} from "vitest";
import {isLikelyFoul} from "@/lib/likely-foul";
import {FULL_SWING_SESSION_HEADERS} from "@/lib/imports/full-swing-session";
import {inspectFullSwingReadings} from "@/lib/imports/full-swing-misreads";
import {contactQuality} from "@/lib/contact-quality";
import {contactConsistency} from "@/lib/contact-consistency";
it.each([[-46,69.9,true],[46,69.9,true],[-45,69.9,false],[45,69.9,false],[60,70,false],[0,35,false],[null,35,false],[91,35,false],[NaN,35,false],[60,0,false]])("flags only valid low-speed contact beyond a foul line",(direction,exitVelocity,result)=>expect(isLikelyFoul({direction,exitVelocity})).toBe(result));
it("marks a likely foul in import review without removing its original cells",()=>{
 const cells=FULL_SWING_SESSION_HEADERS.map(h=>({PitchNo:"1",Batter:"Fictional Hitter",ExitSpeed:"69.9",Direction:"46"} as Record<string,string>)[h]??"null");
 const table={headers:[...FULL_SWING_SESSION_HEADERS],rows:[cells],rowNumbers:[2]};
 const review=inspectFullSwingReadings(table).find(r=>r.field==="ExitSpeed")!;
 expect(review.reason).toContain("Likely Foul");expect(review.blocking).toBe(false);expect(cells[FULL_SWING_SESSION_HEADERS.indexOf("ExitSpeed")]).toBe("69.9");
});
it("keeps soft fair-direction contact and restores flagged contact only in All Contact review",()=>{
 const contacts=[{exitVelocity:60,launchAngle:20,direction:55},{exitVelocity:55,launchAngle:0,direction:0},{exitVelocity:95,launchAngle:20,direction:-12}];
 expect(contactQuality(contacts)).toMatchObject({count:2,hardHit:1,hardHitPct:50});
 expect(contactConsistency(contacts).exitVelocity).toMatchObject({count:2,mean:75});
 expect(contactQuality(contacts,{includeLikelyFouls:true})).toMatchObject({count:3,hardHit:1});
 expect(contactConsistency(contacts,{includeLikelyFouls:true}).exitVelocity?.count).toBe(3);
});
