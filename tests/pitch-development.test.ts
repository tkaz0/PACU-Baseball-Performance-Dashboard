import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Measurement } from "@/lib/imports/engine";
import type { AllowedContact } from "@/lib/contacts-allowed";
import { pitchDevelopment } from "@/lib/pitch-development";
import { PitchDevelopment } from "@/components/pitch-development";

// Fictional fixtures only.
const code="PAC-0001",today="2026-10-13";
function session(hash:string,date:string,velocity:number,vc:number|null,spin:number|null,sc:number|null,category="Intrasquad",type="Four-Seam Fastball"):Measurement[]{
  const fields:[string,number|null,string][]=[["Pitch Type Average Velocity",velocity,"mph"],["Pitch Type Velocity Readings",vc,"count"],["Pitch Type Average Spin",spin,"rpm"],["Pitch Type Spin Readings",sc,"count"]];
  return fields.flatMap(([metric,value,unit],i)=>value===null?[]:[{id:`fictional-${hash}-${i}`,athlete_code:code,metric,value,unit,measured_at:date,source:`Full Swing · ${category} · ${type}`,file_hash:hash.repeat(64),source_file:"fictional.csv",source_sheet:"fictional",source_row:2}]);
}
const contact=(ev:number,date="2026-09-11",category:AllowedContact["category"]="intrasquad",type:AllowedContact["pitchType"]="Four-Seam Fastball"):AllowedContact=>({playedOn:date,category,pitchType:type,exitVelocity:ev,launchAngle:15,direction:0,distance:200,squaredUp:null});
const base=()=>[...session("a","2026-09-11",80,2,1800,1),...session("b","2026-09-11",84,6,2200,3),...session("c","2026-09-25",85,4,null,null)];

describe("pitch development daily summaries",()=>{
  it("weights same-date averages by their own samples, and partitions exact pitch/source categories",()=>{
    const groups=pitchDevelopment([...base(),...session("d","2026-09-11",90,2,2400,2,"Game"),...session("e","2026-09-11",75,2,1600,2,"Practice"),...session("f","2026-09-11",70,3,2300,3,"Intrasquad","Slider")],[],code,"in_game",today);
    const fb=groups.find(g=>g.key==="Intrasquad:Four-Seam Fastball")!;
    expect(fb.days[0]).toMatchObject({velocity:83,velocityCount:8,spin:2100,spinCount:4});
    expect(fb.days[1]).toMatchObject({velocity:85,velocityCount:4,spin:null,spinCount:null});
    expect(groups.some(g=>g.category==="Practice")).toBe(false);
    expect(groups.find(g=>g.category==="Game")?.days[0].velocity).toBe(90);
    expect(groups.find(g=>g.pitchType==="Slider")?.days[0].velocity).toBe(70);
  });
  it("uses only classified, same-pitch/date contact and excludes likely fouls",()=>{
    const contacts=[contact(90),contact(80),{...contact(60),direction:60},contact(100,"2026-09-11","game"),contact(110,"2026-09-11","intrasquad","Slider"),contact(120,"2026-09-11","intrasquad",null),contact(70,"2026-09-25")];
    const group=pitchDevelopment(base(),contacts,code,"in_game",today).find(g=>g.key==="Intrasquad:Four-Seam Fastball")!;
    expect(group.days[0]).toMatchObject({avgEv:85,hardHit:50,balls:2});
    expect(group.days[1]).toMatchObject({avgEv:70,hardHit:0,balls:1});
    const html=renderToStaticMarkup(createElement(PitchDevelopment,{groups:[group],context:"in_game"}));
    expect(html).toContain("Pitch Development");expect(html).toContain("90+ mph");expect(html).toContain("Daily Numbers");
    expect(html).not.toContain('"file_hash"');expect(html).not.toContain('fictional.csv');
  });
  it("keeps missing-average dates as gaps, never a latest fallback, and omits future dates",()=>{
    const rows=[...base(),...session("d","2026-09-20",99,null,2600,2),...session("e","2026-10-20",99,4,2600,2)];
    const g=pitchDevelopment(rows,[],code,"in_game",today)[0];
    expect(g.days.map(d=>d.date)).toEqual(["2026-09-11","2026-09-20","2026-09-25"]);
    expect(g.days[1].velocity).toBeNull();expect(g.days[1].spin).toBe(2600);
    const html=renderToStaticMarkup(createElement(PitchDevelopment,{groups:[g],context:"in_game"}));
    expect(html).toContain('d="M44,'); // one point before the gap; no connecting L to the next date
    expect(html).not.toContain("99.0 mph");
  });
  it("rejects mixed athletes, ambiguous file dates and duplicate averages",()=>{
    const mixed=[...base(),{...base()[0],athlete_code:"PAC-0002"}];
    expect(pitchDevelopment(mixed,[],code,"in_game",today)).toEqual([]);
    expect(pitchDevelopment([...session("a","2026-09-11",80,4,2000,4),...session("a","2026-09-12",81,4,2100,4)],[],code,"in_game",today)).toEqual([]);
    const duplicate=[...session("a","2026-09-11",80,4,null,null),session("a","2026-09-11",80,4,null,null)[0]];
    expect(pitchDevelopment(duplicate,[],code,"in_game",today)).toEqual([]);
  });
  it("keeps practice distinct and provides honest one-date/contact-failure states",()=>{
    const groups=pitchDevelopment(session("a","2026-09-11",80,4,2000,4,"Practice"),[],code,"practice",today);
    const html=renderToStaticMarkup(createElement(PitchDevelopment,{groups,context:"practice"}));
    expect(html).toContain("One recorded date");expect(html).not.toContain('aria-label="Average EV Against');
    expect(html).toContain("Practice contact-against data is not recorded");
    const game=pitchDevelopment(base(),null,code,"in_game",today);
    expect(renderToStaticMarkup(createElement(PitchDevelopment,{groups:game,context:"in_game",contactsAvailable:false}))).toContain("temporarily unavailable");
  });
});
