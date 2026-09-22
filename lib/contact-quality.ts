export type ContactReading = { exitVelocity:number; launchAngle:number };
/** Descriptive MLB reference cuts; these are not Pacific performance grades. */
export function contactQuality(rows:readonly ContactReading[]) {
  const valid=rows.filter(row=>Number.isFinite(row.exitVelocity)&&row.exitVelocity>0&&row.exitVelocity<=200&&Number.isFinite(row.launchAngle)&&Math.abs(row.launchAngle)<=90);
  const hardHit=valid.filter(row=>row.exitVelocity>=95).length;
  const sweetSpot=valid.filter(row=>row.launchAngle>=8&&row.launchAngle<=32).length;
  return {count:valid.length,hardHit,sweetSpot,rateReady:valid.length>=10,
    hardHitPct:valid.length>=10?100*hardHit/valid.length:null,
    sweetSpotPct:valid.length>=10?100*sweetSpot/valid.length:null};
}
