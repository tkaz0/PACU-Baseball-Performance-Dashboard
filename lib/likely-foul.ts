/** Owner-reviewed display rule, not a confirmed fair/foul outcome. */
export const LIKELY_FOUL_EV_MPH = 70;
export const FOUL_LINE_DIRECTION_DEGREES = 45;
export function isLikelyFoul(row:{exitVelocity:number;direction?:number|null}) {
  return Number.isFinite(row.exitVelocity)&&row.exitVelocity>0&&row.exitVelocity<LIKELY_FOUL_EV_MPH&&
    typeof row.direction==="number"&&Number.isFinite(row.direction)&&Math.abs(row.direction)>FOUL_LINE_DIRECTION_DEGREES&&Math.abs(row.direction)<=90;
}
