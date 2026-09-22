import { expect, it } from "vitest";
import { contactQuality } from "@/lib/contact-quality";

it("counts paired batted balls and withholds MLB reference rates at small samples",()=>{
  expect(contactQuality([{exitVelocity:95,launchAngle:8},{exitVelocity:94.9,launchAngle:32}])).toEqual({count:2,hardHit:1,sweetSpot:2,rateReady:false,hardHitPct:null,sweetSpotPct:null});
  const rows=Array.from({length:10},(_,i)=>({exitVelocity:i<6?96:90,launchAngle:i<4?20:40}));
  expect(contactQuality(rows)).toMatchObject({count:10,hardHit:6,sweetSpot:4,hardHitPct:60,sweetSpotPct:40});
});
