export function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key && !url.includes("YOUR_PROJECT") && !key.includes("REPLACE_ME"));
}

export function supabaseConfig() {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured. Follow docs/SETUP.md.");
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! };
}

export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for authentication redirects.");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("APP_URL must use HTTPS except on localhost.");
  }
  return url.origin;
}
