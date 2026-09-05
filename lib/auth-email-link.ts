/** Supabase may prefix emailed token hashes with its PKCE flow marker. */
export function isEmailTokenHash(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && /^(?:pkce_)?[a-f0-9]{40,128}$/i.test(value);
}
