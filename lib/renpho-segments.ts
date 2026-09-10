/** Printed muscle mass, not the percentage compared with the device's standard. */
export const RENPHO_SEGMENTS = [
  { key: "left_arm_muscle_mass", label: "Left Arm Muscle Mass", regionLabel: "Left Arm", column: 23 },
  { key: "right_arm_muscle_mass", label: "Right Arm Muscle Mass", regionLabel: "Right Arm", column: 24 },
  { key: "trunk_muscle_mass", label: "Trunk Muscle Mass", regionLabel: "Trunk", column: 25 },
  { key: "left_leg_muscle_mass", label: "Left Leg Muscle Mass", regionLabel: "Left Leg", column: 26 },
  { key: "right_leg_muscle_mass", label: "Right Leg Muscle Mass", regionLabel: "Right Leg", column: 27 },
] as const;
export type RenphoSegmentKey = typeof RENPHO_SEGMENTS[number]["key"];
export const MUSCLE_BALANCE_REVIEW_PERCENT = 10;
