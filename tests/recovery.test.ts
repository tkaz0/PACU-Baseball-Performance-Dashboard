import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CookieOptions, SetAllCookies } from "@supabase/ssr";
import { requestPasswordRecovery } from "../lib/supabase/recovery";

const legacyName = "sb-recovery-fixture-auth-token-code-verifier";
function harness() {
  const jar = new Map<string, string>([["unrelated-cookie", "keep"]]);
  const commits: { cookies: { name: string; value: string; options: CookieOptions }[]; headers: Record<string, string> }[] = [];
  const challenges: string[] = [];
  let status = 200;
  const cookies = {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: ((values, headers) => {
      commits.push({ cookies: values, headers });
      for (const cookie of values) {
        if (cookie.options.maxAge === 0) jar.delete(cookie.name);
        else jar.set(cookie.name, cookie.value);
      }
    }) satisfies SetAllCookies,
  };
  const send = async () => {
    const commitsBeforeRequest = commits.length;
    return requestPasswordRecovery({
      url: "https://recovery-fixture.supabase.co",
      key: "synthetic-publishable-key",
      email: "synthetic.owner@example.com",
      redirectTo: "http://127.0.0.1:3000/auth/callback",
      cookies,
      fetch: async (input, init) => {
        expect(new URL(String(input)).pathname).toBe("/auth/v1/recover");
        // Exercise real installed SSR/AuthJS, without making a network request.
        expect(commits).toHaveLength(commitsBeforeRequest);
        const body = JSON.parse(String(init?.body));
        expect(body.code_challenge_method).toBe("s256");
        challenges.push(body.code_challenge);
        return new Response(JSON.stringify(status === 200 ? {} : {
          code: "over_email_send_rate_limit", message: "email rate limit exceeded",
        }), { status, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
      },
    });
  };
  const snapshot = () => Array.from(jar).sort(([a], [b]) => a.localeCompare(b));
  const verifier = () => {
    const cookie = jar.get(legacyName)!;
    expect(cookie.startsWith("base64-")).toBe(true);
    return String(JSON.parse(Buffer.from(cookie.slice(7), "base64url").toString())).split("/")[0];
  };
  return { jar, commits, challenges, send, snapshot, verifier, rateLimit: () => { status = 429; } };
}

describe("recovery request cookie commits", () => {
  it("commits a new matching verifier only after each successful provider response", async () => {
    const h = harness();
    expect(await h.send()).toBe(true);
    const first = h.verifier();
    expect(createHash("sha256").update(first).digest("base64url")).toBe(h.challenges[0]);
    expect(await h.send()).toBe(true);
    expect(h.verifier()).not.toBe(first);
    expect(createHash("sha256").update(h.verifier()).digest("base64url")).toBe(h.challenges[1]);
    expect(h.commits).toHaveLength(2);
    expect(h.jar.get("unrelated-cookie")).toBe("keep");
    expect(h.commits[1].headers["Cache-Control"]).toContain("no-store");
    expect(h.commits[1].headers.Expires).toBe("0");
    expect(h.commits[1].headers.Pragma).toBe("no-cache");
    expect(h.commits[1].cookies.find(cookie => cookie.name === legacyName)?.options).toMatchObject({ path: "/", sameSite: "lax" });
  });

  it("preserves every prior verifier cookie when a retry hits 429, including a full flow ring", async () => {
    const h = harness();
    // AuthJS 2.115.0 retains five pending flow slots. A sixth start evicts one.
    for (let index = 0; index < 5; index++) expect(await h.send()).toBe(true);
    const before = h.snapshot();
    const previousVerifier = h.verifier();
    h.rateLimit();
    expect(await h.send()).toBe(false);
    expect(h.commits).toHaveLength(5);
    expect(h.snapshot()).toEqual(before);
    expect(h.verifier()).toBe(previousVerifier);
    expect(createHash("sha256").update(h.verifier()).digest("base64url")).toBe(h.challenges[4]);
  });

  it("does not create verifier cookies when the first request is rate limited", async () => {
    const h = harness();
    const before = h.snapshot();
    h.rateLimit();
    expect(await h.send()).toBe(false);
    expect(h.commits).toHaveLength(0);
    expect(h.snapshot()).toEqual(before);
  });
});
