import { expect, it } from "vitest";
import { contactQuality } from "@/lib/contact-quality";

it("uses 90+ mph and 8–32 degrees on the same paired batted-ball denominator",()=>{
  expect(contactQuality([{exitVelocity:90,launchAngle:8},{exitVelocity:89.9,launchAngle:32}]))
    .toEqual({count:2,hardHit:1,sweetSpot:2,both:1,hardHitPct:50,sweetSpotPct:100,bothPct:50});
  expect(contactQuality([{exitVelocity:91,launchAngle:33},{exitVelocity:89,launchAngle:20},{exitVelocity:90,launchAngle:32}]))
    .toMatchObject({count:3,hardHit:2,sweetSpot:2,both:1,hardHitPct:200/3,sweetSpotPct:200/3,bothPct:100/3});
});
