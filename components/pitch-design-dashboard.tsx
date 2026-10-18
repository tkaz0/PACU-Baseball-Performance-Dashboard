import { buildPitchDesign } from "@/lib/pitch-design";
import type { Measurement } from "@/lib/imports/engine";
import type { PlayerPerformance } from "@/lib/player-performance";
import { PitchDesignView, type PitchDesignHeader } from "@/components/pitch-design-view";
import type { SheetPitchMix } from "@/lib/pitching-stats";

/** The full public reference cohort and private raw readings are never client props. */
export function PitchDesignDashboard({ readings, performance, throws, header, sheetMix = null }: { readings: readonly Measurement[]; performance: PlayerPerformance; throws?: string | null; header?: PitchDesignHeader; sheetMix?: SheetPitchMix | null }) {
  return <PitchDesignView model={buildPitchDesign(readings, performance, throws)} header={header} sheetMix={sheetMix}/>;
}
