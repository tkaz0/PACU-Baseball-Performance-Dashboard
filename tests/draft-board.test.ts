import { expect, it } from "vitest";
import { draftTeamForPick, draftView, draftPlayersFromGroups, DRAFT_GROUPS, emptyDraft, validateDraftDocument, validateDraftSnapshot, draftExportRows } from "@/lib/draft-board";
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
export function fictionalDraft(count = 52) {
  const draft = emptyDraft();
  draft.teams[0].captains = ["Fictional Captain Alpha", "Fictional Captain Beta"];
  draft.teams[1].captains = ["Fictional Captain Gamma", "Fictional Captain Delta"];
  draft.players = Array.from({ length: count }, (_, i) => ({ id: id(i), name: `Fictional Player ${i}`, group: DRAFT_GROUPS[i % 6], positions: "P / OF", athleteId: null }));
  return draft;
}
it("matches all 52 printed pick assignments with equal team totals", () => {
  const first = [1,4,5,8,9,12,13,16,17,20,21,24,25,28,29,32,33,36,37,40,41,44,45,48,49,52];
  expect(Array.from({length:52},(_,i)=>i+1).filter(pick=>draftTeamForPick(pick)===0)).toEqual(first);
  for (const bad of [0,-1,1.1,101,NaN]) expect(()=>draftTeamForPick(bad)).toThrow();
  const draft = fictionalDraft(); draft.picks = draft.players.map(p=>p.id);
  const view = draftView(validateDraftDocument(draft));
  expect(view.complete).toBe(true);expect(view.rosters.map(r=>r.length)).toEqual([26,26]);expect(view.rounds).toHaveLength(26);
  expect(view.rounds[1].map(slot=>slot?.pick)).toEqual([4,3]);
});
it("keeps inactive entries and captains out of the available pool and supports undo",()=>{
  const draft=fictionalDraft(3);draft.players.push({id:id(4),name:"Fictional Assistant",group:"Injured / Student Assistants",positions:"",athleteId:null});
  draft.picks=[draft.players[0].id,draft.players[1].id];
  expect(draftView(draft).available.map(p=>p.id)).toEqual([draft.players[2].id]);
  draft.picks.pop();expect(draftView(draft).available).toHaveLength(2);
  const rows=draftExportRows(draft);expect(rows.filter(row=>row[1]==="Captain")).toHaveLength(4);expect(rows.at(-1)?.[0]).toBe("Not in Draft Pool");
});
it("rejects duplicate players, picks, captain/pool overlap and unreviewed fields",()=>{
  const invalid=[
    {...fictionalDraft(),extra:true}, {}, {...fictionalDraft(),version:"1"},
    {...fictionalDraft(),picks:[id(0),id(0)]}, {...fictionalDraft(),picks:[id(99)]},
    {...fictionalDraft(),players:[...fictionalDraft().players,fictionalDraft().players[0]]},
    {...fictionalDraft(),teams:[{name:"Team 1",captains:["Fictional Player 0"]},{name:"Team 2",captains:[]}]},
    {...fictionalDraft(),teams:[{name:"Same",captains:[]},{name:"same",captains:[]}]},
    {...fictionalDraft(),title:"\nBad"},
  ];
  for(const value of invalid)expect(()=>validateDraftDocument(value)).toThrow();
  const draft=fictionalDraft(1);draft.players[0].group="Injured / Student Assistants";draft.picks=[id(0)];expect(()=>validateDraftDocument(draft)).toThrow();
});
it("preserves IDs and explicit profile links when setup text is edited",()=>{
  const draft=fictionalDraft(1);draft.players[0].athleteId=id(90);
  const groups=Object.fromEntries(DRAFT_GROUPS.map(g=>[g,""])) as Record<typeof DRAFT_GROUPS[number],string>;
  groups.Outfielders="Fictional Player 0 | OF\nFictional New Player | CF";
  const players=draftPlayersFromGroups(groups,draft.players,()=>id(1));
  expect(players[0]).toMatchObject({id:id(0),athleteId:id(90),group:"Outfielders",positions:"OF"});
  expect(players[1].athleteId).toBeNull();
  groups.Pitchers="Name | P | extra";expect(()=>draftPlayersFromGroups(groups,[],()=>id(2))).toThrow();
});
it("requires verified database revision and receipt metadata",()=>{
  const snapshot={revision:1,document:fictionalDraft(),updatedAt:"2026-10-08T20:00:00Z",lastRequestId:id(70)};
  expect(validateDraftSnapshot(snapshot)).toEqual(snapshot);
  for(const patch of [{revision:0},{updatedAt:"bad"},{lastRequestId:"bad"},{extra:true}])expect(()=>validateDraftSnapshot({...snapshot,...patch})).toThrow();
});
