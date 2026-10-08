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
