import { expect,it } from "vitest";
import { emptyDraft, draftPlanning, draftOpenPositions, nextDraftSelection, placeDraftPlayer, withDraftPicks, validateDraftDocument, printedDraftPosition, draftCovers } from "@/lib/draft-board";
import { performanceDraftOrder, type DraftPerformance } from "@/lib/draft-performance";
const id=(n:number)=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,"0")}`;
function fixture(){const d=emptyDraft();d.teams[0].captains=["Fictional Captain"];d.players=[{id:id(1),name:"Fictional Pitcher",group:"Pitchers" as const,positions:"",athleteId:id(11)},{id:id(2),name:"Fictional Outfielder",group:"Outfielders" as const,positions:"OF",athleteId:id(12)},{id:id(3),name:"Fictional Infielder",group:"Infielders" as const,positions:"IF",athleteId:null}];return d;}
it("loads old boards without changing identities, preserves ranks and prunes only undone field assignments",()=>{
  const old=fixture();expect(validateDraftDocument(old)).toEqual(old);expect(draftPlanning(old).bigBoard).toEqual(old.players.map(p=>p.id));
  let d=nextDraftSelection(old,id(1));expect(d.planning?.placements[0]).toEqual([{playerId:id(1),position:"P"}]);
  d=placeDraftPlayer(d,0,"captain-0-0","SS");d=nextDraftSelection(d,id(2));d=placeDraftPlayer(d,1,id(2),"CF");
  const undone=withDraftPicks(d,[id(1)]);expect(undone.planning?.placements[1]).toEqual([]);expect(undone.planning?.placements[0]).toHaveLength(2);expect(undone.planning?.bigBoard).toEqual(d.planning?.bigBoard);
  expect(draftOpenPositions(undone,0)).not.toContain("P");expect(draftOpenPositions(undone,0)).not.toContain("SS");
});
it("rejects cross-team, undrafted, duplicate and invalid placements and incomplete rankings",()=>{
  const d=nextDraftSelection(fixture(),id(1)),plan=draftPlanning(d);
  for(const bad of [{...plan,bigBoard:[id(1)]},{...plan,bigBoard:[id(1),id(1),id(2)]},{...plan,placements:[[],[{playerId:id(1),position:"P"}]]},{...plan,placements:[[{playerId:id(2),position:"CF"}],[]]},{...plan,placements:[[{playerId:id(1),position:"X"}],[]]},{...plan,placements:[[{playerId:id(1),position:"P"},{playerId:id(1),position:"P"}],[]]}])expect(()=>validateDraftDocument({...d,planning:bad})).toThrow();
});
it("never infers an exact outfield/infield position; broad groups only suggest coverage",()=>{
 const d=fixture();expect(printedDraftPosition(d.players[1])).toBeNull();expect(printedDraftPosition(d.players[2])).toBeNull();expect(draftCovers(d.players[1],"CF")).toBe(true);expect(draftCovers(d.players[1],"C")).toBe(false);expect(draftCovers(d.players[2],"SS")).toBe(true);
});
it("keeps missing performance unranked, uses explicit links, preserves ties and separates disciplines",()=>{
 const d=fixture(),line=(score:number)=>({score,rank:1,cohort:8,stats:[],early:true,updatedAt:"2026-10-08T00:00:00Z"});
 const profiles:DraftPerformance[]=[{id:id(11),name:"Fictional Pitcher",position:"P",hitting:line(20),pitching:line(90)},{id:id(12),name:"Fictional Outfielder",position:"OF",hitting:line(90),pitching:null},{id:id(13),name:"Fictional Infielder",position:"IF",hitting:line(100),pitching:null}];
 expect(performanceDraftOrder(d,profiles,"hitting")).toEqual([id(2),id(1),id(3)]);expect(performanceDraftOrder(d,profiles,"pitching")).toEqual([id(1),id(2),id(3)]);profiles[1].hitting=line(20);expect(performanceDraftOrder(d,profiles,"hitting")).toEqual([id(1),id(2),id(3)]);
});

it("allows two-way depth across positions and removes just the selected assignment",()=>{let d=nextDraftSelection(fixture(),id(1));d=placeDraftPlayer(d,0,id(1),"CF");expect(d.planning?.placements[0]).toHaveLength(2);d=placeDraftPlayer(d,0,id(1),null,"CF");expect(d.planning?.placements[0]).toEqual([{playerId:id(1),position:"P"}]);});
