import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ configured: true, createClient: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/env", () => ({ hasSupabaseConfig: () => fake.configured }));
vi.mock("@/lib/supabase/server", () => ({ createClient: fake.createClient }));
vi.mock("@/components/auth-frame", () => ({ AuthFrame: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/submit-button", () => ({ SubmitButton: ({ children }: { children: ReactNode }) => createElement("button", { type: "submit" }, children) }));

import Confirm from "@/app/auth/confirm/page";
import { confirmEmailLink, confirmRecovery } from "@/app/auth/confirm/actions";

// Fictional token and identities only. Auth is mocked; no email or network calls.
const token = "a".repeat(64);
const prefixedToken = `pkce_${"b".repeat(56)}`;
const malformedPrefixedTokens = [
  `pkce${token}`, `pkce-${token}`, `pkce__${token}`, `other_${token}`, `pkce_pkce_${token}`,
  ` ${prefixedToken}`, `${prefixedToken} `, `${prefixedToken}\n`, "pkce_",
  `pkce_${"b".repeat(39)}`, `pkce_${"b".repeat(129)}`, `pkce_${"b".repeat(55)}g`,
];
function form(type: string | undefined, hash = token) {
  const data = new FormData();
  if (type !== undefined) data.set("type", type);
  data.set("token_hash", hash);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  fake.configured = true;
  fake.createClient.mockResolvedValue({ auth: { verifyOtp: fake.verifyOtp } });
  fake.verifyOtp.mockResolvedValue({ data: { user: { id: "fictional-user" }, session: { access_token: "fictional-session" } }, error: null });
});

describe("scanner-safe invitation and recovery landing pages", () => {
  it("uses the fixed site confirmation endpoint and explicit invite type in the email template", () => {
    const template = readFileSync(new URL("../supabase/templates/invite.html", import.meta.url), "utf8");
    expect(template).toContain('{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite');
    expect(template).not.toContain(".ConfirmationURL");
    expect(template).not.toContain(".RedirectTo");
  });
  it.each(["invite", "recovery"])("GET renders %s confirmation without creating an Auth client or consuming a token", async type => {
    const html = renderToStaticMarkup(await Confirm({ searchParams: Promise.resolve({ type, token_hash: token }) }));
    expect(html).toContain(type === "invite" ? "Accept your invitation" : "Reset your password");
    expect(html).toContain(type === "invite" ? "Continue account setup" : "Continue password reset");
    expect(html).toContain(`name="type" value="${type}"`);
    expect(html).toContain(`name="token_hash" value="${token}"`);
    expect(fake.createClient).not.toHaveBeenCalled();
    expect(fake.verifyOtp).not.toHaveBeenCalled();
  });
  it.each(["invite", "recovery"])("GET preserves the prefixed %s token without contacting Auth or consuming it", async type => {
    const html = renderToStaticMarkup(await Confirm({ searchParams: Promise.resolve({ type, token_hash: prefixedToken }) }));
    expect(html).toContain(type === "invite" ? "Continue account setup" : "Continue password reset");
    expect(html).toContain(`name="type" value="${type}"`);
    expect(html).toContain(`name="token_hash" value="${prefixedToken}"`);
    expect(fake.createClient).not.toHaveBeenCalled();
    expect(fake.verifyOtp).not.toHaveBeenCalled();
  });
  it.each(["invite", "recovery"])("GET rejects malformed %s token prefixes without an Auth call or token-bearing redirect", async type => {
    const destination = type === "invite" ? "REDIRECT:/auth/confirm?type=invite&error=invalid" : "REDIRECT:/login?error=reset";
    for (const token_hash of malformedPrefixedTokens) {
      await expect(Confirm({ searchParams: Promise.resolve({ type, token_hash }) })).rejects.toEqual(new Error(destination));
    }
    expect(fake.createClient).not.toHaveBeenCalled();
    expect(fake.verifyOtp).not.toHaveBeenCalled();
  });
  it("shows a token-free invitation failure with sign-in and recovery links", async () => {
    const html = renderToStaticMarkup(await Confirm({ searchParams: Promise.resolve({ type: "invite", error: "invalid" }) }));
    expect(html).toContain("Invitation unavailable");
    expect(html).toContain("Ask your administrator for a fresh invitation");
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("token_hash");
    expect(fake.verifyOtp).not.toHaveBeenCalled();
  });
  it.each(["signup", "magiclink", "email", "email_change", "INVITE", "", undefined])("rejects unsupported landing type %s without Auth calls", async type => {
    await expect(Confirm({ searchParams: Promise.resolve({ type, token_hash: token }) })).rejects.toThrow("REDIRECT:/login?error=reset");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("rejects duplicate URL parameters and redirects malformed invite hashes without carrying the hash", async () => {
    for (const token_hash of [undefined, "not-a-token", token + "\n", "a".repeat(129), [token, token]]) {
      await expect(Confirm({ searchParams: Promise.resolve({ type: "invite", token_hash }) })).rejects.toThrow("REDIRECT:/auth/confirm?type=invite&error=invalid");
    }
    await expect(Confirm({ searchParams: Promise.resolve({ type: ["invite", "recovery"], token_hash: token }) })).rejects.toThrow("REDIRECT:/login?error=reset");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
});

describe("explicit email-link verification", () => {
  it.each(["invite", "recovery"])("POST verifies the exact %s type and uses a fixed password destination", async type => {
    const data = form(type);
    data.set("next", "https://external.example.com/");
    data.set("redirect_to", "https://external.example.com/");
    await expect(confirmEmailLink(data)).rejects.toThrow(type === "invite" ? "REDIRECT:/reset-password?setup=invite" : "REDIRECT:/reset-password");
    expect(fake.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: token, type });
  });
  it.each(["invite", "recovery"])("POST passes the entire prefixed %s token unchanged to verifyOtp", async type => {
    await expect(confirmEmailLink(form(type, prefixedToken))).rejects.toThrow(type === "invite" ? "REDIRECT:/reset-password?setup=invite" : "REDIRECT:/reset-password");
    expect(fake.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: prefixedToken, type });
  });
  it.each([40, 128])("accepts a prefixed token with %s hexadecimal suffix characters on both GET and POST", async length => {
    const boundaryToken = `pkce_${"Ab".repeat(length / 2)}`;
    const html = renderToStaticMarkup(await Confirm({ searchParams: Promise.resolve({ type: "recovery", token_hash: boundaryToken }) }));
    expect(html).toContain(`name="token_hash" value="${boundaryToken}"`);
    expect(fake.createClient).not.toHaveBeenCalled();
    await expect(confirmEmailLink(form("recovery", boundaryToken))).rejects.toThrow("REDIRECT:/reset-password");
    expect(fake.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: boundaryToken, type: "recovery" });
  });
  it.each(["invite", "recovery"])("POST rejects malformed %s token prefixes before touching Auth", async type => {
    const destination = type === "invite" ? "REDIRECT:/auth/confirm?type=invite&error=invalid" : "REDIRECT:/login?error=reset";
    for (const hash of malformedPrefixedTokens) {
      await expect(confirmEmailLink(form(type, hash))).rejects.toEqual(new Error(destination));
    }
    expect(fake.createClient).not.toHaveBeenCalled();
    expect(fake.verifyOtp).not.toHaveBeenCalled();
  });
  it.each(["signup", "magiclink", "email", "email_change", "INVITE", "", undefined])("rejects POST type %s before touching Auth", async type => {
    await expect(confirmEmailLink(form(type))).rejects.toThrow("REDIRECT:/login?error=reset");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("rejects duplicated fields and non-string or malformed tokens before Auth", async () => {
    const duplicatedType = form("invite"); duplicatedType.append("type", "recovery");
    await expect(confirmEmailLink(duplicatedType)).rejects.toThrow("REDIRECT:/login?error=reset");
    const duplicatedToken = form("invite"); duplicatedToken.append("token_hash", token);
    const fileToken = form("invite"); fileToken.set("token_hash", new File([token], "fictional-token.txt"));
    for (const data of [duplicatedToken, fileToken, form("invite", ""), form("invite", token + "\n"), form("invite", "a".repeat(39)), form("invite", "a".repeat(129))]) {
      await expect(confirmEmailLink(data)).rejects.toThrow("REDIRECT:/auth/confirm?type=invite&error=invalid");
    }
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("rejects expired, replayed, failed and incomplete verification without exposing provider details", async () => {
    for (const response of [
      { data: { user: null, session: null }, error: { message: "fictional expired token" } },
      { data: { user: null, session: null }, error: null },
      { data: { user: { id: "fictional-user" }, session: null }, error: null },
    ]) {
      fake.verifyOtp.mockResolvedValueOnce(response);
      await expect(confirmEmailLink(form("invite"))).rejects.toThrow("REDIRECT:/auth/confirm?type=invite&error=invalid");
    }
    fake.verifyOtp.mockRejectedValueOnce(new Error("fictional network failure"));
    await expect(confirmEmailLink(form("invite"))).rejects.toThrow("REDIRECT:/auth/confirm?type=invite&error=invalid");
  });
  it("requires a fresh provider verification on replay rather than reusing a previous success", async () => {
    await expect(confirmEmailLink(form("invite"))).rejects.toThrow("REDIRECT:/reset-password?setup=invite");
    fake.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "otp_expired" } });
    await expect(confirmEmailLink(form("invite"))).rejects.toThrow("REDIRECT:/auth/confirm?type=invite&error=invalid");
    expect(fake.verifyOtp).toHaveBeenCalledTimes(2);
  });
  it("keeps the recovery failure destination and original recovery action compatible", async () => {
    await expect(confirmRecovery(form(undefined))).rejects.toThrow("REDIRECT:/reset-password");
    expect(fake.verifyOtp).toHaveBeenLastCalledWith({ token_hash: token, type: "recovery" });
    fake.verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: "fictional expired" } });
    await expect(confirmEmailLink(form("recovery"))).rejects.toThrow("REDIRECT:/login?error=reset");
    fake.createClient.mockClear();
    await expect(confirmRecovery(form("invite"))).rejects.toThrow("REDIRECT:/login?error=reset");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("does not contact Auth when Supabase is unconfigured", async () => {
    fake.configured = false;
    await expect(confirmEmailLink(form("invite"))).rejects.toThrow("REDIRECT:/login");
    expect(fake.createClient).not.toHaveBeenCalled();
  });
});
