import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  enabled: true,
  origin: "https://pacu.example.com",
  events: [] as string[],
  requireAdminMutation: vi.fn(),
  invitationsEnabled: vi.fn(),
  createAuthAdministrator: vi.fn(),
  from: vi.fn(),
  athlete: vi.fn(),
  link: vi.fn(),
  originalRpc: vi.fn(),
  currentRpc: vi.fn(),
  privilegedRpc: vi.fn(),
  listUsers: vi.fn(),
  inviteUserByEmail: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireAdminMutation: fake.requireAdminMutation }));
vi.mock("@/lib/supabase/auth-admin", () => ({
  createAuthAdministrator: fake.createAuthAdministrator,
  invitationsEnabled: fake.invitationsEnabled,
}));
vi.mock("@/lib/env", () => ({ appUrl: () => fake.origin }));

import { emailIsNew, parseInvitation } from "@/lib/account-invitation";
import { inviteAccount } from "@/app/(workspace)/admin/access/invite-actions";

// These marked fictional identities are used only by mocked services. No provider calls or email sends.
const email = "fictional.player@example.com";
const athleteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const invitedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function invitationForm(role = "player") {
  const form = new FormData();
  form.set("email", email);
  form.set("role", role);
  form.set("athlete_id", role === "coach" ? "" : athleteId);
  form.set("confirm", "yes");
  return form;
}
function page(users: { email?: string }[] = [], nextPage?: number | null) {
  return { data: { users, nextPage }, error: null };
}
const redirect = (result: string) => `REDIRECT:/admin/access?invite=${result}`;

beforeEach(() => {
  vi.resetAllMocks();
  fake.enabled = true;
  fake.origin = "https://pacu.example.com";
  fake.events = [];
  fake.invitationsEnabled.mockImplementation(() => fake.enabled);
  fake.requireAdminMutation.mockImplementation(async () => {
    const current = fake.requireAdminMutation.mock.calls.length > 1;
    fake.events.push(current ? "authorize-again" : "authorize");
    return { supabase: { from: fake.from, rpc: current ? fake.currentRpc : fake.originalRpc } };
  });
  fake.from.mockImplementation((table: string) => {
    fake.events.push(`read:${table}`);
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: table === "athletes" ? fake.athlete : fake.link }) }) };
  });
  fake.athlete.mockResolvedValue({ data: { id: athleteId }, error: null });
  fake.link.mockResolvedValue({ data: null, error: null });
  fake.listUsers.mockImplementation(async () => {
    fake.events.push("directory");
    return page();
  });
  fake.inviteUserByEmail.mockImplementation(async () => {
    fake.events.push("invite");
    return { data: { user: { id: invitedId, email } }, error: null };
  });
  fake.currentRpc.mockImplementation(async () => {
    fake.events.push("provision");
    return { error: null };
  });
  fake.createAuthAdministrator.mockReturnValue({
    listUsers: fake.listUsers,
    inviteUserByEmail: fake.inviteUserByEmail,
    rpc: fake.privilegedRpc,
  });
});

describe("explicit invitation choices", () => {
  it("normalizes email and UUID casing while preserving the administrator's explicit player choice", () => {
    const form = invitationForm();
    form.set("email", "  Fictional.Player@EXAMPLE.COM  ");
    form.set("athlete_id", athleteId.toUpperCase());
    expect(parseInvitation(form)).toEqual({ email, role: "player", athleteId });
    expect(parseInvitation(invitationForm("coach"))).toEqual({ email, role: "coach", athleteId: null });
  });
  it.each(["email", "role", "athlete_id", "confirm"])("requires exactly one string %s field", key => {
    const duplicate = invitationForm();
    duplicate.append(key, duplicate.get(key) as string);
    const missing = invitationForm();
    missing.delete(key);
    const file = invitationForm();
    file.set(key, new File(["fictional input"], "fictional.txt"));
    for (const form of [duplicate, missing, file]) expect(parseInvitation(form)).toBeNull();
  });
  it.each(["admin", "player,admin", "coach,admin", "Player", "", "owner"])("does not permit role %s through invitations", role => {
    expect(parseInvitation(invitationForm(role))).toBeNull();
  });
  it("requires a valid player UUID, no coach link, and explicit send approval", () => {
    for (const link of ["", "LOCAL-0001", "fictional.player@example.com", `${athleteId}\n`]) {
      const form = invitationForm(); form.set("athlete_id", link);
      expect(parseInvitation(form)).toBeNull();
    }
    const coach = invitationForm("coach"); coach.set("athlete_id", athleteId);
    expect(parseInvitation(coach)).toBeNull();
    for (const confirmation of ["", "true", "on", "YES"]) {
      const form = invitationForm(); form.set("confirm", confirmation);
      expect(parseInvitation(form)).toBeNull();
    }
  });
  it.each(["", "fictional@example", "fictional player@example.com", "a@b@example.com", `${"a".repeat(243)}@example.com`])("rejects invalid email %s", value => {
    const form = invitationForm(); form.set("email", value);
    expect(parseInvitation(form)).toBeNull();
  });
});

describe("new-recipient directory checks", () => {
  it("checks every page before considering an address new", async () => {
    const list = vi.fn().mockResolvedValueOnce(page([{ email: "fictional.other@example.com" }, {}], 2)).mockResolvedValueOnce(page([], null));
    await expect(emailIsNew(email, list)).resolves.toBe("new");
    expect(list.mock.calls).toEqual([[1], [2]]);
  });
  it("finds an existing address case-insensitively and stops immediately", async () => {
    const list = vi.fn().mockResolvedValueOnce(page([], 2)).mockResolvedValueOnce(page([{ email: email.toUpperCase() }], 3));
    await expect(emailIsNew(email, list)).resolves.toBe("existing");
    expect(list.mock.calls).toEqual([[1], [2]]);
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "fictional provider failure" } },
    { ...page(), error: { message: "fictional partial result" } },
    page([], 3),
    page([], 1),
  ])("fails closed on errors, missing data, and nonconsecutive pagination", async response => {
    const list = vi.fn().mockResolvedValue(response);
    await expect(emailIsNew(email, list)).resolves.toBe("unavailable");
    expect(list).toHaveBeenCalledTimes(1);
  });
  it("does not treat the bounded scan as a complete directory when another page remains", async () => {
    const list = vi.fn(async (number: number) => page([], number + 1));
    await expect(emailIsNew(email, list)).resolves.toBe("unavailable");
    expect(list).toHaveBeenCalledTimes(20);
    expect(list).toHaveBeenLastCalledWith(20);
  });
  it("allows a fully read twentieth page and recognizes existing users there", async () => {
    const complete = vi.fn(async (number: number) => page([], number === 20 ? null : number + 1));
    await expect(emailIsNew(email, complete)).resolves.toBe("new");
    const existing = vi.fn(async (number: number) => page(number === 20 ? [{ email }] : [], number + 1));
    await expect(emailIsNew(email, existing)).resolves.toBe("existing");
  });
});

describe("administrator invitation workflow", () => {
  it("requires a current administrator before validating input, reading configuration, or touching any service", async () => {
    fake.requireAdminMutation.mockRejectedValueOnce(new Error("REDIRECT:/login"));
    await expect(inviteAccount(new FormData())).rejects.toThrow("REDIRECT:/login");
    expect(fake.invitationsEnabled).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.createAuthAdministrator).not.toHaveBeenCalled();
    expect(fake.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it("rejects unapproved or elevated requests before configuration or provider access", async () => {
    for (const form of [new FormData(), invitationForm("admin")]) {
      await expect(inviteAccount(form)).rejects.toThrow(redirect("input"));
    }
    expect(fake.invitationsEnabled).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.createAuthAdministrator).not.toHaveBeenCalled();
  });
  it("does not read player data or contact Auth until sender configuration is enabled", async () => {
    fake.enabled = false;
    await expect(inviteAccount(invitationForm())).rejects.toThrow(redirect("setup"));
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.createAuthAdministrator).not.toHaveBeenCalled();
    expect(fake.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it.each(["missing", "athlete-error", "linked", "link-error"])("rejects %s player preflight before creating the privileged Auth client", async reason => {
    if (reason === "missing") fake.athlete.mockResolvedValue({ data: null, error: null });
    if (reason === "athlete-error") fake.athlete.mockResolvedValue({ data: null, error: { message: "fictional denied" } });
    if (reason === "linked") fake.link.mockResolvedValue({ data: { user_id: invitedId }, error: null });
    if (reason === "link-error") fake.link.mockResolvedValue({ data: null, error: { message: "fictional denied" } });
    await expect(inviteAccount(invitationForm())).rejects.toThrow(redirect("athlete"));
    expect(fake.createAuthAdministrator).not.toHaveBeenCalled();
    expect(fake.inviteUserByEmail).not.toHaveBeenCalled();
  });
  it.each(["existing", "provider-error", "thrown", "cap"])("sends nothing after a rejected %s directory check", async reason => {
    if (reason === "existing") fake.listUsers.mockResolvedValue(page([{ email }]));
    if (reason === "provider-error") fake.listUsers.mockResolvedValue({ data: null, error: { message: `fictional private error for ${email}` } });
    if (reason === "thrown") fake.listUsers.mockRejectedValue(new Error(`fictional private error for ${email}`));
    if (reason === "cap") fake.listUsers.mockImplementation(async ({ page: number }: { page: number }) => page([], number + 1));
    await expect(inviteAccount(invitationForm())).rejects.toEqual(new Error(redirect(reason === "existing" ? "existing" : "unavailable")));
    expect(fake.requireAdminMutation).toHaveBeenCalledTimes(1);
    expect(fake.inviteUserByEmail).not.toHaveBeenCalled();
    expect(fake.currentRpc).not.toHaveBeenCalled();
    expect(fake.privilegedRpc).not.toHaveBeenCalled();
  });
  it("rechecks authorization immediately before sending and stops if the actor is no longer permitted", async () => {
    fake.requireAdminMutation.mockResolvedValueOnce({ supabase: { from: fake.from, rpc: fake.originalRpc } }).mockRejectedValueOnce(new Error("REDIRECT:/access-denied"));
    await expect(inviteAccount(invitationForm())).rejects.toThrow("REDIRECT:/access-denied");
    expect(fake.listUsers).toHaveBeenCalledTimes(1);
    expect(fake.requireAdminMutation).toHaveBeenCalledTimes(2);
    expect(fake.inviteUserByEmail).not.toHaveBeenCalled();
    expect(fake.currentRpc).not.toHaveBeenCalled();
  });
  it("uses the configured origin and returned Auth identity, then provisions through the freshly authorized normal session", async () => {
    const form = invitationForm();
    form.set("next", "https://external.example.com/");
    form.set("redirect_to", "https://external.example.com/");
    form.set("origin", "https://external.example.com/");
    form.set("target_user", "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    await expect(inviteAccount(form)).rejects.toThrow(redirect("sent"));
    expect(fake.events).toEqual(["authorize", "read:athletes", "read:account_athletes", "directory", "authorize-again", "invite", "provision"]);
    expect(fake.listUsers).toHaveBeenCalledExactlyOnceWith({ page: 1, perPage: 100 });
    expect(fake.inviteUserByEmail).toHaveBeenCalledExactlyOnceWith(email, { redirectTo: "https://pacu.example.com/auth/confirm" });
    expect(fake.currentRpc).toHaveBeenCalledExactlyOnceWith("admin_provision_invited_account", { target_user: invitedId, account_role: "player", linked_athlete: athleteId });
    expect(fake.originalRpc).not.toHaveBeenCalled();
    expect(fake.privilegedRpc).not.toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledExactlyOnceWith("/admin/access");
  });
  it("provisions a coach without selecting or linking an athlete", async () => {
    await expect(inviteAccount(invitationForm("coach"))).rejects.toThrow(redirect("sent"));
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.currentRpc).toHaveBeenCalledExactlyOnceWith("admin_provision_invited_account", { target_user: invitedId, account_role: "coach", linked_athlete: null });
  });
  it.each(["provider-error", "timeout", "missing-user", "invalid-id", "different-email"])("does not provision or automatically retry after %s delivery uncertainty", async reason => {
    if (reason === "provider-error") fake.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: `fictional secret provider detail for ${email}` } });
    if (reason === "timeout") fake.inviteUserByEmail.mockRejectedValue(new Error(`fictional timeout after sending to ${email}`));
    if (reason === "missing-user") fake.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: null });
    if (reason === "invalid-id") fake.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "not-a-uuid", email } }, error: null });
    if (reason === "different-email") fake.inviteUserByEmail.mockResolvedValue({ data: { user: { id: invitedId, email: "fictional.other@example.com" } }, error: null });
    await expect(inviteAccount(invitationForm())).rejects.toEqual(new Error(redirect("delivery")));
    expect(fake.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(fake.currentRpc).not.toHaveBeenCalled();
    expect(fake.originalRpc).not.toHaveBeenCalled();
    expect(fake.privilegedRpc).not.toHaveBeenCalled();
  });
  it.each(["error", "timeout"])("reports email success plus provisioning %s for review without resending or exposing provider details", async reason => {
    if (reason === "error") fake.currentRpc.mockResolvedValue({ error: { message: `fictional private database detail for ${email}` } });
    else fake.currentRpc.mockRejectedValue(new Error(`fictional uncertain database result for ${email}`));
    await expect(inviteAccount(invitationForm())).rejects.toEqual(new Error(redirect("review")));
    expect(fake.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(fake.currentRpc).toHaveBeenCalledTimes(1);
    expect(fake.privilegedRpc).not.toHaveBeenCalled();
    expect(fake.revalidatePath).toHaveBeenCalledExactlyOnceWith("/admin/access");
  });
});
