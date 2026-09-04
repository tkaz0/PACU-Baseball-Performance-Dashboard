import previewRows from "@/fixtures/preview-roster.json";
import type { RosterAthlete } from "@/lib/types";

/** Public preview data is a checked-in copy of the fictional CSV, never a database read. */
export function getPreviewRoster(): RosterAthlete[] {
  return previewRows.map((row): RosterAthlete => {
    if (!/^SYN-\d{3}$/.test(row.athlete_code) || !row.first_name.startsWith("Fictional ") ||
        !row.pacific_email.endsWith("@example.com") || row.profile_photo_url) {
      throw new Error("The public preview only supports fictional fixture records.");
    }

    // Preview URLs use fixture codes, deliberately separate from database athlete UUIDs.
    return {
      id: row.athlete_code,
      athlete_code: row.athlete_code,
      first_name: row.first_name,
      preferred_name: row.preferred_name || null,
      last_name: row.last_name,
      pacific_email: row.pacific_email,
      profile_photo_url: null,
      created_at: "",
      updated_at: "",
      athlete_seasons: [{
        athlete_id: row.athlete_code,
        season: "2026",
        jersey_number: row.jersey_number === "" ? null : Number(row.jersey_number),
        primary_position: row.primary_position || null,
        secondary_position: row.secondary_position || null,
        player_type: row.player_type || null,
        bats: row.bats || null,
        throws: row.throws || null,
        academic_class: row.academic_class || null,
        eligibility_year: row.eligibility_year === "" ? null : Number(row.eligibility_year),
        graduation_year: row.graduation_year === "" ? null : Number(row.graduation_year),
        roster_status: row.roster_status || null,
      }],
    };
  }).sort((a, b) => a.last_name.localeCompare(b.last_name));
}
