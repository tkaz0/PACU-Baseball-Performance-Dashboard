/** Public references only; these entries never classify a player's recorded pitches. */
export const PITCH_GRIP_SOURCE = {
  name: "Pitch Grip Database",
  author: "Nate Rasmussen",
  url: "https://rasmussenbaseball.com/tools/pitch-grips",
  lastChecked: "2026-09-29",
  usageNote: "Coach-selected experiments: compare measured results and feel before keeping a change.",
  navigationNote: "Open the database, select the Shape filter, then find the catalog name.",
} as const;

export type PitchGripReference = {
  /** PACU key, not a published source anchor or an inferred player grip. */
  id: string;
  pitchTypes: string[];
  /** Exact catalog title; a source code is retained when the catalog provides one. */
  name: string;
  /** Brief PACU paraphrase of a grip experiment, without a promised result. */
  cue: string;
  sourceUrl: string;
  /** Exact Shape filter label in Rasmussen's database. */
  filterLabel: string;
  /** Original technique reference cited by the catalog entry. */
  techniqueSourceUrl: string;
};

// The database exposes no verified entry anchors. Keep its real URL intact and
// identify each entry by its catalog title and visible Shape filter instead.
// No source images, numerical targets, or inferred pronation labels are copied.
export const PITCH_GRIP_REFERENCES: readonly PitchGripReference[] = [
  {
    id: "rasmussen-ff1",
    pitchTypes: ["Four-Seam Fastball"],
    name: "FF1 — Standard four-seam",
    cue: "Try seam contact with index and middle fingertips.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Fastball",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-four-seam-fastball",
  },
  {
    id: "rasmussen-ft1",
    pitchTypes: ["Two-Seam Fastball", "Sinker"],
    name: "FT1 — Standard two-seam / sinker",
    cue: "Position index and middle along the narrow seams.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Sinker",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-sinker-or-two-seam-fastball",
  },
  {
    id: "rasmussen-ct1",
    pitchTypes: ["Cutter"],
    name: "CT1 — Standard cutter (four-seam offset)",
    cue: "Offset a close four-seam grip toward the pinky.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Cutter",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-cutter",
  },
  {
    id: "rasmussen-sl1",
    pitchTypes: ["Slider"],
    name: "SL1 — Standard Offset",
    cue: "Explore a close four-seam grip shifted sideways.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Slider",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-slider",
  },
  {
    id: "rasmussen-sl3",
    pitchTypes: ["Slider"],
    name: "SL3 — Standard Around",
    cue: "Shift fingers between seams nearer the horseshoe.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Slider",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-slider",
  },
  {
    id: "rasmussen-sweeper-1",
    pitchTypes: ["Sweeper"],
    name: "Sweeper 1 — Inside Horseshoe",
    cue: "Try fingers inside the horseshoe with two-seam orientation.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Sweeper",
    techniqueSourceUrl: "https://www.pitchingcoachu.com/blog/mmv057",
  },
  {
    id: "rasmussen-cb1",
    pitchTypes: ["Curveball"],
    name: "CB1 — Standard curveball",
    cue: "Explore middle-finger seam contact, with index alongside.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Curveball",
    techniqueSourceUrl: "https://drivelinebaseball.com/blogs/blog/how-to-throw-a-curveball",
  },
  {
    id: "rasmussen-traditional-changeup",
    pitchTypes: ["Changeup"],
    name: "Traditional changeup (two-seam, ring finger on seam)",
    cue: "Try seam contact through middle and ring fingers.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Changeup",
    techniqueSourceUrl: "https://rocklandpeakperformance.com/how-to-throw-a-changeup/",
  },
  {
    id: "rasmussen-circle-changeup",
    pitchTypes: ["Changeup"],
    name: "Circle changeup",
    cue: "Join thumb and index into a circle.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Changeup",
    techniqueSourceUrl: "https://rocklandpeakperformance.com/how-to-throw-a-changeup/",
  },
  {
    id: "rasmussen-splitter-1",
    pitchTypes: ["Splitter"],
    name: "Splitter 1 — Standard",
    cue: "Explore wider index-middle spacing with the thumb underneath.",
    sourceUrl: PITCH_GRIP_SOURCE.url,
    filterLabel: "Splitter",
    techniqueSourceUrl: "https://rocklandpeakperformance.com/how-to-throw-a-splitter/",
  },
];
