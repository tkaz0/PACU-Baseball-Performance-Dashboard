import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/env", () => ({ hasSupabaseConfig: () => true, appUrl: vi.fn(), supabaseConfig: vi.fn() }));
vi.mock("@/lib/supabase/recovery", () => ({ requestPasswordRecovery: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: fake.createClient }));
vi.mock("@/components/auth-frame", () => ({ AuthFrame: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/submit-button", () => ({ SubmitButton: ({ children }: { children: ReactNode }) => createElement("button", { type: "submit" }, children) }));

import { updatePassword } from "@/app/auth/actions";
import ResetPassword from "@/app/reset-password/page";

// Generated test strings and a fictional account only; all Auth operations are mocked.
function passwordForm(length: number, invite: boolean, matching = true) {
  const form = new FormData();
  form.set("password", "x".repeat(length));
  form.set("confirm", (matching ? "x" : "y").repeat(length));
  if (invite) form.set("setup", "invite");
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  fake.createClient.mockResolvedValue({ auth: { getUser: fake.getUser, updateUser: fake.updateUser, signOut: fake.signOut } });
  fake.getUser.mockResolvedValue({ data: { user: { id: "fictional-user" } }, error: null });
  fake.updateUser.mockResolvedValue({ error: null });
  fake.signOut.mockResolvedValue({ error: null });
});

describe.each([{ flow: "recovery", invite: false }, { flow: "invitation", invite: true }])("$flow password policy", ({ invite }) => {
  const errorPath = invite ? "/reset-password?setup=invite&error=" : "/reset-password?error=";

  it.each([6, 7, 8, 128])("accepts a matching %i-character password and requests global sign-out", async length => {
    await expect(updatePassword(passwordForm(length, invite))).rejects.toThrow("REDIRECT:/login?updated=1");
    expect(fake.getUser).toHaveBeenCalledExactlyOnceWith();
    expect(fake.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "x".repeat(length) });
    expect(fake.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "global" });
  });

  it.each([5, 129])("rejects a %i-character password before Auth and retains the flow", async length => {
    await expect(updatePassword(passwordForm(length, invite))).rejects.toThrow(`REDIRECT:${errorPath}password`);
    expect(fake.createClient).not.toHaveBeenCalled();
    expect(fake.updateUser).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();
  });

  it("rejects a different confirmation of the same valid length", async () => {
    await expect(updatePassword(passwordForm(6, invite, false))).rejects.toThrow(`REDIRECT:${errorPath}password`);
    expect(fake.createClient).not.toHaveBeenCalled();
  });

  it("retains the flow after a provider rejection without claiming success", async () => {
    fake.updateUser.mockResolvedValueOnce({ error: { message: "Fictional provider rejection" } });
    await expect(updatePassword(passwordForm(6, invite))).rejects.toThrow(`REDIRECT:${errorPath}update`);
    expect(fake.signOut).not.toHaveBeenCalled();
  });

  it("requires a verified user before changing a password", async () => {
    fake.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(updatePassword(passwordForm(6, invite))).rejects.toThrow("REDIRECT:/login?error=reset");
    expect(fake.updateUser).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();
  });

  it("renders matching 6–128 limits and retains invitation setup after an error", async () => {
    const html = renderToStaticMarkup(await ResetPassword({ searchParams: Promise.resolve({ error: "password", ...(invite ? { setup: "invite" } : {}) }) }));
    expect(html).toContain(invite ? "Choose your password" : "Choose a new password");
    expect(html).toContain(invite ? "Create password" : "Update password");
    expect(html).toContain("6–128 characters");
    expect(html).toContain("both passwords match");
    expect(html.match(/minLength="6"/g)).toHaveLength(2);
    expect(html.match(/maxLength="128"/g)).toHaveLength(2);
    expect(html).not.toContain("12–128");
    expect(html).not.toContain("8–128");
    if (invite) expect(html).toContain('name="setup" value="invite"');
    else expect(html).not.toContain('name="setup"');
    expect(fake.updateUser).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();
  });
});
