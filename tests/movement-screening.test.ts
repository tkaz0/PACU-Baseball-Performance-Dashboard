import {it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {createElement} from "react";
import {MOVEMENT_SOURCE,parseMovementPayload,movementTone,type MovementReading} from "@/lib/movement-screening";
import {MovementScreening} from "@/components/movement-screening";
export const sample=()=>({version:1,source:MOVEMENT_SOURCE,reports:[{athleteCode:"PAC-0001",sheetId:42,screenedOn:"2026-09-15",sourceHash:"a".repeat(64),readings:Array.from({length:24},(_,i)=>({row:i+2,sourceRow:i+2,value:i>=2&&i<=13?"45":"3",reference:null,color:"none"}))}]});
it("preserves source flags over scale colors and keeps unflagged degrees neutral",()=>{
 const rating:MovementReading={row:2,sourceRow:2,value:"4",reference:null,color:"none"};
 expect(movementTone(rating)).toBe("green");expect(movementTone({...rating,color:"yellow"})).toBe("yellow");expect(movementTone({...rating,value:"3",color:"red"})).toBe("red");expect(movementTone({...rating,value:"1"})).toBe("red");expect(movementTone({...rating,value:"3"})).toBe("yellow");expect(movementTone({...rating,row:4})).toBe("none");expect(movementTone({...rating,value:null,color:"red"})).toBe("none");
});
it("validates every coordinate, degree, date, rating and rejects unknown data",()=>{
 expect(parseMovementPayload(sample()).reports).toHaveLength(1);
 for(const mutate of [(p:ReturnType<typeof sample>)=>{p.reports[0].readings[0].value="6";},(p:ReturnType<typeof sample>)=>{p.reports[0].readings[2].value="unknown";},(p:ReturnType<typeof sample>)=>{p.reports[0].screenedOn="2026-09-31";},(p:ReturnType<typeof sample>)=>{p.reports[0].readings[0].row=3;},(p:ReturnType<typeof sample>)=>{p.reports.push(p.reports[0]);}]){const p=sample();mutate(p);expect(()=>parseMovementPayload(p)).toThrow();}
 expect(()=>parseMovementPayload({...sample(),raw:"private"})).toThrow();
});
it("renders date, scale and paired ROM with textual color cues, without staff references by default",()=>{
 const report=parseMovementPayload(sample()).reports[0];report.readings[2].reference="Assessor reference";
 const html=renderToStaticMarkup(createElement(MovementScreening,{report}));
 expect(html).toContain("Sep 15, 2026");expect(html).toContain("5 is best");expect(html).toContain("45");expect(html).toContain("Right");expect(html).toContain("Left");expect(html).not.toContain("Assessor reference");
 expect(renderToStaticMarkup(createElement(MovementScreening,{report,showReferences:true}))).toContain("Assessor reference");
});
it("treats all four ankle readings as ratings, separately from shoulder and hip degrees",()=>{
 const payload=sample(),report=parseMovementPayload(payload).reports[0];
 for(const row of [16,17,18,19]){
  expect(movementTone({...report.readings[row-2],value:"4",color:"none"})).toBe("green");
  for(const invalid of ["45","0","6","3.5","Good"]){const bad=sample();bad.reports[0].readings[row-2].value=invalid;expect(()=>parseMovementPayload(bad)).toThrow();}
 }
 const html=renderToStaticMarkup(createElement(MovementScreening,{report}));
 const ankle=html.split('data-testid="ankle-ratings"')[1].split('</section>')[0];
 expect(ankle).toContain("Ankle Ratings");expect(ankle).toContain("/ 5");expect(ankle).not.toContain("°");
 const rom=html.split('data-testid="movement-rom"')[1].split('</section>')[0];expect(rom).toContain("°");expect(rom).not.toContain("Ankle");
});
