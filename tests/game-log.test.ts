import {expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {validateGameLog,loggedBattingRates,type GameLog,type GameLogInput} from "@/lib/game-log";
import {LimitedSample} from "@/components/limited-sample";
import {PlayerGameLog} from "@/components/player-game-log";
const id="11111111-1111-4111-8111-111111111111";
const entry=():GameLogInput=>({requestId:id,id,expectedVersion:0,athleteId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",playedOn:"2026-09-01",opponent:"Fictional Owls",gameNumber:1,kind:"game",batting:{pa:5,ab:4,h:2,doubles:1,triples:0,hr:0,bb:1,hbp:0,sf:0,sh:0,k:1},pitching:{}});
const log=():GameLog=>{const {requestId,expectedVersion,...v}=entry();void requestId;void expectedVersion;return {...v,version:1,updatedAt:"2026-09-02T12:00:00Z"};};
it("preserves unknown counts and normalizes opponent whitespace",()=>{const v=validateGameLog({...entry(),opponent:"  Fictional   Owls ",batting:{ab:4}},"2026-09-12");expect(v.batting).toEqual({ab:4});expect(v.opponent).toBe("Fictional Owls");});
it("rejects malformed identities, dates, count types and inconsistent outcomes",()=>{
 const b=entry().batting;for(const change of [{athleteId:"not-an-id"},{playedOn:"2026-02-30"},{playedOn:"2026-09-30"},{gameNumber:0},{kind:"spring"},{opponent:"\nOwls"},{unexpected:1},{batting:{...b,h:5}},{batting:{...b,hr:3}},{batting:{...b,sf:1}},{batting:{...b,doubles:2,triples:1}},{batting:{ab:1.5}},{batting:{ab:"4"}},{batting:{},pitching:{}},{pitching:{pitches:10,strikes:11}},{pitching:{bf:5,k:3,bb:3,h:0}}])expect(()=>validateGameLog({...entry(),...change},"2026-09-12")).toThrow();
});
it("weights recent rates by opportunities and calculates supported power measures",()=>{
 const a=log(),b={...a,id:"22222222-2222-4222-8222-222222222222",batting:{...a.batting,pa:2,ab:1,h:0,doubles:0,bb:1,k:1}};
 const rates=loggedBattingRates([a,b]);expect(rates.find(r=>r.label==="AVG")).toMatchObject({value:2/5,opportunities:5});expect(rates.find(r=>r.label==="OBP")?.value).toBe(4/7);expect(rates.find(r=>r.label==="SLG")?.value).toBe(3/5);expect(rates.find(r=>r.label==="ISO")?.value).toBe(1/5);
 const missing={...b,batting:{ab:1}};expect(loggedBattingRates([a,missing])).toEqual([]);expect(loggedBattingRates([a,{...b,athleteId:"other"}])).toEqual([]);
});
it("labels samples at documented boundaries without changing data",()=>{
 for(const [count,pitching,shown]of [[19,false,true],[20,false,false],[49,true,true],[50,true,false],[0,false,false],[null,false,false]] as const)expect(renderToStaticMarkup(createElement(LimitedSample,{count,pitching})).includes("Limited sample")).toBe(shown);
});
it("renders real dated games and an honest empty state",()=>{
 expect(renderToStaticMarkup(createElement(PlayerGameLog,{logs:[]}))).toContain("Your first recorded game");
 const html=renderToStaticMarkup(createElement(PlayerGameLog,{logs:[log()]}));expect(html).toContain("Fictional Owls");expect(html).toContain("Last 1 Logged Batting Game");expect(html).toContain("Separate from QPA sheet totals");expect(html).not.toContain('role="meter"');
});
