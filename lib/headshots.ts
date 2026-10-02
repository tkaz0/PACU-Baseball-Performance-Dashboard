/** Public Pacific athletics roster photos; only the reviewed site-relative path is stored. */
const HEADSHOT_PATH = /^\/images\/\d{4}\/\d{1,2}\/\d{1,2}\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/;
export function headshotSrc(path: string | null | undefined, width = 240): string | null {
  return path && HEADSHOT_PATH.test(path) ? `https://goboxers.com${path}?width=${width}&quality=85` : null;
}
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
