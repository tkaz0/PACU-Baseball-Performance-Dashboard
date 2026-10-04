import { isLikelyFoul } from "@/lib/likely-foul";
export type ContactReading = { exitVelocity:number; launchAngle:number; direction?:number|null };
/** Descriptive team EV and recorded launch-angle windows, not hit outcomes. */
export function contactQuality(rows:readonly ContactReading[],{includeLikelyFouls=false}:{includeLikelyFouls?:boolean}={}) {
  const valid=rows.filter(row=>(includeLikelyFouls||!isLikelyFoul(row))&&Number.isFinite(row.exitVelocity)&&row.exitVelocity>0&&row.exitVelocity<=200&&Number.isFinite(row.launchAngle)&&Math.abs(row.launchAngle)<=90);
  const hardHit=valid.filter(row=>row.exitVelocity>=90).length;
  const sweetSpot=valid.filter(row=>row.launchAngle>=8&&row.launchAngle<=32).length;
  const both=valid.filter(row=>row.exitVelocity>=90&&row.launchAngle>=8&&row.launchAngle<=32).length;
  return {count:valid.length,hardHit,sweetSpot,both,
    hardHitPct:valid.length?100*hardHit/valid.length:0,
    sweetSpotPct:valid.length?100*sweetSpot/valid.length:0,
    bothPct:valid.length?100*both/valid.length:0};
}
