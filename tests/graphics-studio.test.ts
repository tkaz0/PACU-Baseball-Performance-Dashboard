import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphicsStudio } from "@/components/graphics-studio";
import { GraphicsPlayerPicker } from "@/components/graphics-player-picker";
import { graphicsExample, graphicsSecond, graphicsBoards } from "./fixtures/graphics";
const players=[graphicsExample,graphicsSecond].map(data=>({id:data.player.id,name:data.player.name,searchName:data.player.name,athleteCode:data.player.code}));
const fixture={player:graphicsExample,second:graphicsSecond,boards:graphicsBoards};
describe("quick graphics workflow",()=>{
 it("keeps optional editing behind disclosure and main choices concise",()=>{
  const html=renderToStaticMarkup(createElement(GraphicsStudio,{staff:true,players,ownAthleteId:graphicsExample.player.id,fixture}));
  expect(html).toContain('aria-label="Graphic type"');expect(html).not.toContain('aria-label="Graphic templates"');
  expect(html).toContain('aria-label="Instagram 4:5"');expect(html).toContain('aria-label="Story 9:16"');expect(html).toContain('aria-label="X 16:9"');
  expect(html).toMatch(/<details[^>]*><summary>.*?Customize/s);expect(html).not.toMatch(/<details[^>]*\bopen/);
  expect(html.indexOf('Save Image')).toBeLessThan(html.indexOf('Loading Results'));
  expect(html).toContain('Hitting · Practice (Blast)');expect(html).not.toContain('Hitting · Blast · Fall 2026 · Practice · Fall Average');
 });
 it("does not ship team choices or peer-player names into player mode",()=>{
  const html=renderToStaticMarkup(createElement(GraphicsStudio,{staff:false,players:[],ownAthleteId:graphicsExample.player.id,fixture:{player:graphicsExample}}));
  expect(html).not.toContain('Team Leaders');expect(html).not.toContain('Compare Players');expect(html).not.toContain(graphicsSecond.player.name);
  expect(html).not.toContain('aria-autocomplete="list"');expect(html).toContain(graphicsExample.player.name);
 });
 it("provides one accessible searchable field without duplicating the whole roster at rest",()=>{
  const html=renderToStaticMarkup(createElement(GraphicsPlayerPicker,{players,value:graphicsExample.player.id,onChange:()=>{}}));
  expect(html).toContain('role="combobox"');expect(html).toContain('aria-expanded="false"');expect(html).toContain('aria-autocomplete="list"');
  expect(html).toContain('value="Alex Example"');expect(html).not.toContain('Jordan Sample');expect(html).not.toContain('PAC-9998');
 });
});
