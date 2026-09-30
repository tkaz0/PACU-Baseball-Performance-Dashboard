import { DesignPlayerPicker } from "@/components/design-player-picker";
import type { StaffAthleteChoice } from "@/lib/staff-athlete-search";

export function PitchDesignPlayerPicker({ players, selectedId }: { players: StaffAthleteChoice[]; selectedId: string }) {
  return <DesignPlayerPicker players={players} selectedId={selectedId} kind="pitch"/>;
}
