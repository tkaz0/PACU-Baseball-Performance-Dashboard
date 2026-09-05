import { UUID_PATTERN } from "@/lib/types";

export type Invitation = { email: string; role: "coach" | "player"; athleteId: string | null };
export function parseInvitation(form: FormData): Invitation | null {
  const values = ["email", "role", "athlete_id", "confirm"].map(key => form.getAll(key));
  if (values.some(items => items.length !== 1 || typeof items[0] !== "string")) return null;
  const [emailValue, role, athlete, confirm] = values.map(items => items[0] as string);
  const email = emailValue.trim().toLowerCase();
  if (confirm !== "yes" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (role !== "coach" && role !== "player") ||
      (role === "player" ? !UUID_PATTERN.test(athlete) : athlete !== "")) return null;
  return { email, role, athleteId: athlete ? athlete.toLowerCase() : null };
}

type DirectoryResult = { data: { users: { email?: string }[]; nextPage?: number | null } | null; error: unknown };
/** Fail closed on incomplete directory reads. Existing users need reviewed access/recovery, never another invitation. */
export async function emailIsNew(email: string, list: (page: number) => Promise<DirectoryResult>) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await list(page);
    if (error || !data) return "unavailable" as const;
    if (data.users.some(user => user.email?.toLowerCase() === email)) return "existing" as const;
    if (!data.nextPage) return "new" as const;
    if (data.nextPage !== page + 1) return "unavailable" as const;
  }
  return "unavailable" as const;
}
