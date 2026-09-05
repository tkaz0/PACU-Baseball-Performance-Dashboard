export type Role = "admin" | "coach" | "player";
export type Athlete = {
  id: string; athlete_code: string; first_name: string; preferred_name: string | null;
  last_name: string; pacific_email: string | null; profile_photo_url: string | null;
  created_at: string; updated_at: string;
};
export type AthleteSeason = {
  athlete_id: string; season: string; jersey_number: number | null;
  primary_position: string | null; secondary_position: string | null; player_type: string | null;
  bats: string | null; throws: string | null; academic_class: string | null;
  eligibility_year: number | null; graduation_year: number | null; roster_status: string | null;
};
export type RosterAthlete = Athlete & {
  athlete_seasons: AthleteSeason[];
  /** Exact former local IDs retained when the owner renumbers an athlete. */
  athlete_code_aliases?: string[];
  /** Optional browser-local identifiers; never columns in the protected Supabase roster. */
  renpho_id?: string | null;
  renpho_ids?: string[];
};
export type ImportRow = {
  row: number; athlete_code: string; action: "create" | "update" | "unchanged" | "reject";
  errors: string[]; changes: { field: string; before: string | number | null; after: string | number | null }[];
};
export type ImportPreview = { rows: ImportRow[]; create: number; update: number; unchanged: number; reject: number };
export type ImportDraft = {
  id: string; created_by: string; season: string; filename: string; source_sha256: string;
  preview: ImportPreview; status: "draft" | "applied"; created_at: string; applied_at: string | null;
};
export function athleteName(a: Pick<Athlete, "first_name" | "preferred_name" | "last_name">) {
  return `${a.preferred_name || a.first_name} ${a.last_name}`;
}
export function display(value: string | number | null | undefined) { return value == null || value === "" ? "—" : String(value).replaceAll("_", " "); }
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
