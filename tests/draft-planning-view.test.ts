import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { DraftDepthChart, DraftBigBoard } from "@/components/draft-planning";
import { emptyDraft, placeDraftPlayer } from "@/lib/draft-board";
it("renders all field spots, captain depth, backup controls and independent private board ordering",()=>{
 let d=emptyDraft();d.teams[0].captains=["Fictional Captain Alpha","Fictional Captain Beta"];
 d=placeDraftPlayer(d,0,"captain-0-0","C");d=placeDraftPlayer(d,0,"captain-0-1","C");
 const html=renderToStaticMarkup(createElement(DraftDepthChart,{document:d,team:0,disabled:false,onSave:()=>{}}));
 expect(html).toContain('aria-label="C: Fictional Captain Alpha, 1 backups"');expect(html).toContain("Two-way and utility players can appear at multiple spots");
 expect(html).toContain('aria-label="RF: Open"');expect(html).toContain('aria-label="DH: Open"');
 const board=renderToStaticMarkup(createElement(DraftBigBoard,{document:d,performance:null,disabled:false,onSave:()=>{},onError:()=>{}}));
 expect(board).toContain("Performance suggestions are temporarily unavailable");expect(board).toContain("Save Big Board");expect(board).toContain("not a talent prediction");
});

it("embeds performance, editable ranks and draft selection in the same big board",()=>{
 const d=emptyDraft();d.players=[{id:"aaaaaaaa-aaaa-4aaa-8aaa-000000000001",name:"Fictional Hitter",group:"Outfielders",positions:"OF",athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-000000000002"}];
 const html=renderToStaticMarkup(createElement(DraftBigBoard,{document:d,performance:[{id:d.players[0].athleteId!,name:"Fictional Hitter",position:"OF",hitting:{score:82.25,rank:2,cohort:10,stats:[{label:"OBP",value:".400",sample:"20 PA"}],early:false,updatedAt:"2026-10-08T00:00:00Z"},pitching:null}],disabled:false,onSave:()=>{},onError:()=>{},onSelect:()=>{},canDraft:true}));
 expect(html).toContain('Rank for Fictional Hitter</span>');expect(html).toContain('aria-label="Select Fictional Hitter for draft"');expect(html).toContain("Hitting score · 82.3/100");expect(html).toContain("20 PA");expect(html).toContain("stronger complete hitting or pitching score, never a sum");expect(html).toContain("Rank by Performance");expect(html).toContain("Big board position group");
});
