import { expect, it } from "vitest";
import { coachUpdateDigest } from "@/lib/coach-update-digest";
import type { CoachingData } from "@/lib/coaching-tools";
const player={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",code:"PAC-0001",name:"Fictional Player",academicClass:"Junior",position:"OF",playerType:"position",bats:"R",throws:"R"};
const row=(id:string,date:string,value:number,importedAt:string,source="RENPHO")=>({id,athleteId:player.id,metric:"muscle_mass",label:"Muscle Mass",unit:"lb",source,date,value,importedAt});
it("shows recent saved measurements, distinct-date changes and stale follow-up without inventing games",()=>{
  const data:CoachingData={players:[player,{...player,id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",code:"PAC-0002",name:"Fictional Teammate"}],readings:[row("old","2026-09-09",100,"2026-09-09T18:00:00Z"),row("new","2026-09-20",108,"2026-09-21T04:00:00Z")],games:[]};
  const digest=coachUpdateDigest(data,"2026-09-22");
  expect(digest.recentReadings).toBe(1);expect(digest.updatedPlayers).toHaveLength(1);
  expect(digest.changes).toMatchObject([{percent:8,value:108,previous:100}]);
  expect(digest.stale.map(item=>item.name)).toEqual(["Fictional Teammate"]);
  expect(digest.games.every(item=>item.players===0&&item.lastSynced===null)).toBe(true);
});
