import { buildPitchDesign } from "@/lib/pitch-design";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPerformance } from "@/lib/player-performance";
import { PitchDesignView } from "@/components/pitch-design-view";

/** The full public reference cohort and private raw readings are never client props. */
export function PitchDesignDashboard({ readings, performance, throws }: { readings: readonly Measurement[]; performance: PlayerPerformance; throws?: string | null }) {
  return <PitchDesignView model={buildPitchDesign(readings, performance, throws)}/>;
}
