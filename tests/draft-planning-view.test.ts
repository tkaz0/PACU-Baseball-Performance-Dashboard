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
 const board=renderToStaticMarkup(createElement(DraftBigBoard,{document:d,athletes:[],disabled:false,onSave:()=>{},onError:()=>{}}));
 expect(board).toContain("Your rankings are entirely manual");expect(board).toContain("Save Big Board");expect(board).not.toContain("Rank by Performance");
});

it("keeps manual ranks and draft selection without performance scores or automated ordering",()=>{
 const d=emptyDraft();d.players=[{id:"aaaaaaaa-aaaa-4aaa-8aaa-000000000001",name:"Fictional Hitter",group:"Outfielders",positions:"OF",athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-000000000002"}];
 const html=renderToStaticMarkup(createElement(DraftBigBoard,{document:d,athletes:[{id:d.players[0].athleteId!,name:"Fictional Hitter"}],disabled:false,onSave:()=>{},onError:()=>{},onSelect:()=>{},canDraft:true}));
 expect(html).toContain('Rank for Fictional Hitter</span>');expect(html).toContain('aria-label="Select Fictional Hitter for draft"');expect(html).toContain("Reset to Draft List Order");expect(html).toContain("Profile matched");expect(html).toContain("Big board position group");
 for(const removed of ["Rank by Performance","Hitter Order","Pitcher Order","/100","Top Performers","Hitting score","Pitching score"])expect(html).not.toContain(removed);
});
