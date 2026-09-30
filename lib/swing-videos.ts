export const SWING_VIDEO_BUCKET = "swing-videos";
export const MAX_SWING_VIDEO_BYTES = 50 * 1024 * 1024;
export const SWING_VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as const;
export type SwingVideoType = keyof typeof SWING_VIDEO_TYPES;
export type SwingVideo = { id: string; fileHash: string; sourceRow: number; title: string; bytes: number; createdAt: string };
export function swingContactKey(fileHash: string, sourceRow: number) { return `${fileHash}:${sourceRow}`; }
export function isSwingVideoType(value: unknown): value is SwingVideoType { return typeof value === "string" && Object.hasOwn(SWING_VIDEO_TYPES,value); }
export function validSwingVideoTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && Array.from(value).length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
}
export function validSwingVideoSize(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_SWING_VIDEO_BYTES; }
