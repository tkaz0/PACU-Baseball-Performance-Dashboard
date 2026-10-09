/** Explicit display-only contracts. Observation identities and report provenance stay on the server. */
export type GraphicsCategory = "physicality" | "hitting" | "pitching" | "game-hitting" | "game-pitching";
export type GraphicsPlayer = {
  id: string; name: string; code: string; position: string; secondaryPosition: string;
  academicClass: string; bats: string; throws: string;
};
export type GraphicsMetric = {
  /** Stable exact metric/source/unit/period partition; never an observation or report ID. */
  key: string; label: string; category: GraphicsCategory; value: number; formatted: string;
  unit: string; source: string; context: string; date: string; sample: string;
  percentile: number | null; direction: "higher" | "lower" | "neutral";
};
export type GraphicsArsenal = {
  source: string; label: string; pitchType: string; category: "Game" | "Intrasquad" | "Practice";
  averageVelocity: number | null; maxVelocity: number | null; averageSpin: number | null; maxSpin: number | null;
  velocityCount: number | null; spinCount: number | null;
  firstDate: string; lastDate: string; basis: string;
  velocityBasis: "fall" | "latest" | null; spinBasis: "fall" | "latest" | null;
  velocityFirstDate: string | null; velocityLastDate: string | null;
  spinFirstDate: string | null; spinLastDate: string | null;
  maxVelocityDate: string | null; maxSpinDate: string | null;
};
export type GraphicsTrend = {
  key: string; label: string; unit: string; source: string; context: string;
  points: { date: string; value: number }[];
};
export type GraphicsPlayerData = {
  player: GraphicsPlayer; metrics: GraphicsMetric[]; arsenals: GraphicsArsenal[]; trends: GraphicsTrend[];
};
export type GraphicsLeaderboard = {
  key: string; label: string; category: GraphicsCategory; unit: string; source: string;
  context: string; period: string; date: string;
  rows: { name: string; rank: number; value: number; formatted: string; sample: string; date: string }[];
};
/** Weekly leaders without PAC codes or profile ids. */
export type GraphicsWeekCard = { name: string; headlineValue: string; headlineLabel: string; stats: { label: string; value: string }[]; sample: string; early: boolean; tied: boolean };
export type GraphicsWeek = { week: number; label: string; date: string | null; hitting: GraphicsWeekCard | null; pitching: GraphicsWeekCard | null };
export type GraphicsDataResponse =
  | { kind: "player"; data: GraphicsPlayerData }
  | { kind: "leaderboards"; boards: GraphicsLeaderboard[] }
  | { kind: "weekly"; weeks: GraphicsWeek[] };
