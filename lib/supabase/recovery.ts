import { createServerClient, type CookieOptions, type GetAllCookies, type SetAllCookies } from "@supabase/ssr";

type CookieWrite = { name: string; value: string; options: CookieOptions };
type RecoveryRequest = {
  url: string;
  key: string;
  email: string;
  redirectTo: string;
  cookies: { getAll: GetAllCookies; setAll: SetAllCookies };
  fetch?: typeof globalThis.fetch;
};

/** Keep failed recovery attempts from replacing the last successful PKCE verifier. */
export async function requestPasswordRecovery(request: RecoveryRequest): Promise<boolean> {
  // This buffer belongs to one recovery request only. Other Auth operations must
  // continue to persist token refreshes, sign-outs, and session cookies normally.
  const jar = new Map((await request.cookies.getAll() ?? []).map(({ name, value }) => [name, value]));
  const pending: CookieWrite[] = [];
  const pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient(request.url, request.key, {
    ...(request.fetch ? { global: { fetch: request.fetch } } : {}),
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll(values, headers) {
        Object.assign(pendingHeaders, headers);
        for (const cookie of values) {
          // Preserve ordered removals, chunks, and domain/path attributes.
          pending.push({ ...cookie, options: { ...cookie.options } });
          const expired = (cookie.options.maxAge !== undefined && cookie.options.maxAge <= 0)
            || (cookie.options.expires !== undefined && cookie.options.expires.getTime() <= Date.now());
          if (expired) jar.delete(cookie.name);
          else jar.set(cookie.name, cookie.value);
        }
      },
    },
  });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(request.email, { redirectTo: request.redirectTo });
    if (error) return false;
  } catch {
    // A failed/uncertain provider request must not flush its staged cookie writes.
    return false;
  }

  // Do not swallow response-cookie failures after a successful send.
  if (pending.length > 0) await request.cookies.setAll(pending, pendingHeaders);
  return true;
}
