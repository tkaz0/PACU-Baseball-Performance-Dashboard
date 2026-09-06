import type { GameSourceKey, ReviewedGameSource } from "@/lib/game-source";

// User-selected source metadata, not credentials. Contents stay behind Drive permissions.
export const GAME_SOURCES: Record<GameSourceKey, ReviewedGameSource> = {
  qpa_fall_2026: { source: "qpa_fall_2026", spreadsheetId: "1z9X5flQ7s7ffBS1ygBLST6FCP9Tww3xtwTFFczjupuE", sheetId: 529725170, sheetTitle: "2026 - Fall", detailRows: [...Array.from({length:35},(_,i)=>i+2),38] },
  pitching_fall_2026: { source: "pitching_fall_2026", spreadsheetId: "1lY6ryVAa24zfngG5vjVuw3aytBOg_dsWZwLk0q1Akeo", sheetId: 0, sheetTitle: "FALL", detailRows: [[40,70],[76,106],[113,143],[150,180],[187,217]].flatMap(([first,last])=>Array.from({length:last-first+1},(_,i)=>first+i)) },
};
export const GAME_SOURCE_LABELS: Record<GameSourceKey,string> = { qpa_fall_2026: "QPA · 2026 - Fall", pitching_fall_2026: "Pitching · FALL" };
export const GAME_SYNC_START = "2026-09-12";
export const GAME_CAPTURE_SHAPES: Record<GameSourceKey,{rows:number;columns:number;range:string}> = {
 qpa_fall_2026:{rows:968,columns:33,range:"'2026 - Fall'!A1:AG968"},
 pitching_fall_2026:{rows:1025,columns:31,range:"'FALL'!A1:AE1025"},
};
