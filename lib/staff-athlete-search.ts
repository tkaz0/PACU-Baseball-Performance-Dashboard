import { athleteName, type Athlete } from "@/lib/types";

export type StaffSearchAthlete = Pick<Athlete, "id" | "athlete_code" | "first_name" | "preferred_name" | "last_name">;
export type StaffAthleteChoice = { id: string; name: string; athleteCode: string; searchName: string };

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US").trim();

/** Only names and a permanent profile identifier cross the staff search boundary. */
export function staffAthleteChoice(athlete: StaffSearchAthlete): StaffAthleteChoice {
  return { id: athlete.id, name: athleteName(athlete), athleteCode: athlete.athlete_code,
    searchName: `${athlete.first_name} ${athlete.preferred_name ?? ""} ${athlete.last_name}` };
}

export function matchesStaffAthlete(athlete: StaffAthleteChoice, query: string): boolean {
  const terms = normalize(query.slice(0, 100)).split(/\s+/).filter(Boolean);
  const name = normalize(`${athlete.searchName} ${athlete.name} ${athlete.athleteCode}`);
  return terms.every(term => name.includes(term));
}
