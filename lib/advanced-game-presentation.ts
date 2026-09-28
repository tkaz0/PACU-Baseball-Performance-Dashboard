/** Presentation priorities only. Calculation, cohort and access rules stay in their existing readers. */
export const ADVANCED_HITTING_METRICS = ["batting_production_plus", "batting_est_slg", "batting_est_iso", "batting_est_wobacon"] as const;
export const ADVANCED_PITCHING_METRICS = ["pitching_k_bb", "pitching_k9", "pitching_bb9", "pitching_whip"] as const;
export const isAdvancedGameMetric = (metric: string) => [...ADVANCED_HITTING_METRICS, ...ADVANCED_PITCHING_METRICS].some(key => key === metric);
export const ADVANCED_GAME_CUES: Record<string, string> = {
  batting_production_plus: "Team reference = 100",
  batting_est_slg: "Bases per at-bat",
  batting_est_iso: "Extra bases per at-bat",
  batting_est_wobacon: "Value of recorded contact",
  pitching_k_bb: "Strikeouts for each walk",
  pitching_k9: "Strikeouts per nine innings",
  pitching_bb9: "Walks per nine innings · Lower is better",
  pitching_whip: "Hits + walks per inning · Lower is better",
};
