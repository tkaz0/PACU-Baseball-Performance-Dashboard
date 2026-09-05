import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlayerPerformanceProfile } from "@/components/player-performance-profile";
import { getPlayerPerformance } from "@/lib/player-performance";
import type { RosterAthlete } from "@/lib/types";

function fictionalAthlete(playerType: string | null): RosterAthlete {
  return { id: "SYN-001", athlete_code: "SYN-001", first_name: "Fictional Avery", preferred_name: "Avery", last_name: "Northstar",
    pacific_email: "fictional.avery@example.com", profile_photo_url: null, created_at: "", updated_at: "", renpho_id: "FICTIONAL-RENPHO",
    athlete_seasons: [{ athlete_id: "SYN-001", season: "2026-27", jersey_number: 0, primary_position: "CF", secondary_position: "P",
      player_type: playerType, bats: "L", throws: "R", academic_class: "freshman", eligibility_year: 1, graduation_year: 2030, roster_status: "active" }] };
}

describe("player profile presentation", () => {
  it.each([
    { type: "position", hitting: true, pitching: false },
    { type: "pitcher", hitting: false, pitching: true },
    { type: "two_way", hitting: true, pitching: true },
    { type: null, hitting: true, pitching: true },
    { type: "unclassified", hitting: true, pitching: true },
  ])("shows relevant groups for $type without exposing account/roster administration", ({ type, hitting, pitching }) => {
    const athlete = fictionalAthlete(type);
    const performance = getPlayerPerformance({ readings: [], athleteCode: athlete.athlete_code });
    const html = renderToStaticMarkup(createElement(PlayerPerformanceProfile, { athlete, performance }));
    expect(html.includes('id="hitting-performance"')).toBe(hitting);
    expect(html.includes('id="pitching-performance"')).toBe(pitching);
    expect(html).toContain('id="body-measurements"');
    expect(html).toContain("Avery Northstar");
    expect(html).toContain("CF / P");
    expect(html).toContain("L / R");
    expect(html).toContain("2026-27");
    expect(html).toMatch(/Jersey number<\/dt><dd[^>]*>0<\/dd>/);
    expect(html).not.toContain(athlete.pacific_email);
    expect(html).not.toContain(athlete.athlete_code);
    expect(html).not.toContain(athlete.renpho_id);
    expect(html).not.toContain("Eligibility year");
    expect(html).not.toContain('role="meter"');
    expect(html).not.toContain('data-value="0"');
    expect(html).not.toContain("Pacific n=0");
    expect(html).toContain("No data");
    expect(html).toContain("Sources &amp; percentile method");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/);
  });
});
