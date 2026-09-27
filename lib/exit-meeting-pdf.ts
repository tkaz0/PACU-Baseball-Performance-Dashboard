import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { exitMeetingPacificDate, type ExitMeetingReport, type ExitMeetingOptions, type ExitMeetingRow } from "@/lib/exit-meeting";

const colors = { ink: rgb(.08,.12,.18), muted: rgb(.34,.39,.46), red: rgb(.68,.08,.15), blue: rgb(.12,.39,.66), light: rgb(.95,.96,.97), line: rgb(.85,.88,.90), white: rgb(1,1,1), gold: rgb(.72,.48,.08), green: rgb(.10,.43,.30) };
const textSafe = (value: string) => value.normalize("NFC").replace(/[′’‘]/g,"'").replace(/[″“”]/g,'"').replace(/[−–—]/g,"-").replace(/→/g,"to").replace(/\u00a0/g," ").replace(/[^\x20-\x7e\u00a1-\u00ff\n]/g,"?");
function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of textSafe(value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) { if (font.widthOfTextAtSize(line + character, size) > width && line) { lines.push(line); line = ""; } line += character; }
    }
    lines.push(line);
  }
  return lines;
}
const day = (value: string) => /^\d{4}-\d\d-\d\d$/.test(value) ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric", timeZone:"UTC" }) : value;

/** Request-scoped PDF bytes only. No report files, raw imports, or coach notes are persisted. */
export async function createExitMeetingPdf(report: ExitMeetingReport, options: ExitMeetingOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`PACU Baseball Exit Meeting - ${report.name}`);
  pdf.setAuthor("PACU Baseball Performance"); pdf.setSubject("Private player development meeting");
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoSvg = await readFile(path.join(process.cwd(), "app/icon.svg"), "utf8");
  const logoPaths = [...logoSvg.matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
  if (!logoPaths.length) throw new Error("The report brand asset could not be loaded.");
  const width = 612, height = 792, margin = 38, content = width-margin*2;
  let page: PDFPage, y = 0, activeSection = "Player Report";
  const draw = (value: string, x: number, top: number, size = 10, strong = false, color = colors.ink) => page.drawText(textSafe(value), { x, y: height-top-size, size, font: strong ? bold : regular, color });
  const line = (top: number) => page.drawLine({start:{x:margin,y:height-top},end:{x:width-margin,y:height-top},thickness:.6,color:colors.line});
  function newPage(label = "Player Report") {
    page = pdf.addPage([width,height]); y = 74;
    page.drawRectangle({x:0,y:height-5,width,height:5,color:colors.red});
    const logoScale = 29 / 124;
    for (const svgPath of logoPaths) page.drawSvgPath(svgPath,{x:margin-124*logoScale,y:height-20-5*logoScale,scale:logoScale,color:colors.red});
    draw("PACU / BASEBALL PERFORMANCE",margin+36,22,8,true,colors.red);
    draw(`${report.name} ${report.jersey} · ${label}`,margin+36,36,9,true);
    line(60);
  }
  const ensure = (needed:number,label?:string) => { if(y+needed>730)newPage(label ?? `${activeSection} Continued`); };
  function paragraph(value:string, size=9, color=colors.muted, strong=false, gap=9) {
    for(const text of wrap(value,strong?bold:regular,size,content)){ensure(size+5);draw(text,margin,y,size,strong,color);y+=size+4;} y+=gap;
  }
  function heading(title:string, subtitle:string) {
    activeSection = title; ensure(96,title); y+=10;
    page.drawRectangle({x:margin,y:height-y-23,width:4,height:23,color:colors.red});
    const titleLines=wrap(title,bold,17,content-16); for(const text of titleLines){draw(text,margin+13,y,17,true);y+=21;}
    y+=5; paragraph(subtitle,8.5); line(y); y+=11;
  }
  function percentile(value:number,x:number,top:number,w:number) {
    const stops=[colors.blue,rgb(.70,.81,.90),rgb(.91,.91,.92),rgb(.86,.59,.61),colors.red];
    for(let i=0;i<5;i++)page.drawRectangle({x:x+i*w/5,y:height-top-5,width:w/5+.1,height:5,color:stops[i]});
    const marker=x+w*Math.max(0,Math.min(100,value))/100;
    page.drawCircle({x:marker,y:height-top-2.5,size:3.6,color:colors.ink,borderColor:colors.white,borderWidth:.8});
  }
  function metricRow(r:ExitMeetingRow, index:number) {
    const labelLines=wrap(r.label,bold,9,190),valueLines=wrap(r.value,bold,12,150);
    const metaLines=wrap(`${r.source} · ${r.date} · ${r.basis}${r.sample ? ` · ${r.sample}` : ""}`,regular,7.6,content-20);
    const rowHeight=Math.max(labelLines.length*12,valueLines.length*14,30)+metaLines.length*10+16;
    ensure(rowHeight,`${activeSection} Continued`);
    if(index%2===0)page.drawRectangle({x:margin,y:height-y-rowHeight,width:content,height:rowHeight,color:colors.light});
    if(r.tone&&r.tone!=="none")page.drawRectangle({x:margin,y:height-y-rowHeight,width:3,height:rowHeight,color:r.tone==="green"?colors.green:r.tone==="yellow"?colors.gold:colors.red});
    labelLines.forEach((t,i)=>draw(t,margin+10,y+8+i*12,9,true));
    valueLines.forEach((t,i)=>draw(t,margin+210,y+7+i*14,12,true));
    const rankX=margin+386;
    if(r.percentile!==null){draw(`Percentile ${Math.round(r.percentile)}`,rankX,y+6,8,true);percentile(r.percentile,rankX,y+22,128);draw(`${r.peers} teammates`,rankX,y+32,6.7,false,colors.muted);}
    else{draw("No team percentile",rankX,y+9,7.3,false,colors.muted);if(r.peers!==null)draw(`${r.peers} comparable teammates`,rankX,y+21,6.7,false,colors.muted);}
    const metaTop=y+Math.max(labelLines.length*12,valueLines.length*14,30)+10;
    metaLines.forEach((t,i)=>draw(t,margin+10,metaTop+i*10,7.6,false,colors.muted)); y+=rowHeight;
  }
  newPage("Exit Meeting");
  draw("THE NEXT CHAPTER",margin,y,9,true,colors.red);y+=20;
  for(const name of wrap(report.name,bold,32,content)){draw(name,margin,y,32,true);y+=37;}
  paragraph(`${report.jersey} ${report.position} · ${report.academicClass} · ${report.batsThrows}`,10,colors.ink,true);
  paragraph(`${report.code} · ${report.season} · Meeting ${day(options.meetingDate)}`,9);
  const facts=[{label:"RESULTS",value:String(report.sections.reduce((n,s)=>n+s.rows.length,0))},{label:"COMPARABLE STATS",value:String(report.sections.flatMap(s=>s.rows).filter(r=>r.percentile!==null).length)},{label:"LAST TESTED",value:report.lastTested?day(report.lastTested):"Not recorded"}];
  facts.forEach((f,i)=>{const x=margin+i*(content/3+2),w=content/3-5;page.drawRectangle({x,y:height-y-67,width:w,height:67,color:colors.light});draw(f.label,x+12,y+12,7,true,colors.muted);draw(f.value,x+12,y+31,i===2?11:21,true);});y+=85;
  heading("Meeting Snapshot","Where the saved results stand today");
  const groups=[{title:"Strengths",items:report.strengths,color:colors.red,empty:"No directional stats currently meet the 75th-percentile threshold with enough comparable teammates."},{title:"Development Areas",items:report.development,color:colors.blue,empty:"No directional stats currently meet the 25th-percentile threshold with enough comparable teammates."},{title:"Biggest Jumps",items:report.jumps,color:colors.green,empty:"A comparable result on another test date is needed to show a measured improvement."}];
  for(const group of groups){ensure(65);draw(group.title.toUpperCase(),margin,y,9,true,group.color);y+=19;
    if(!group.items.length){paragraph(group.empty,9);continue;}
    for(const item of group.items){const details=wrap(item.detail,regular,8,content-20);ensure(29+details.length*11);draw(`${item.label}${item.percentile!==null?` · Percentile ${Math.round(item.percentile)}`:""}`,margin+8,y,10,true);y+=16;for(const text of details){draw(text,margin+8,y,8,false,colors.muted);y+=11;}y+=10;}
  }
  if(options.talkingPoints){heading("Coach Talking Points","Added for this meeting · Included only in this downloaded PDF");paragraph(options.talkingPoints,10,colors.ink);}
  if(report.missing.length){heading("Still to Add","Missing results remain blank, not zero");paragraph(report.missing.join(" · "),9);}
  for(const section of report.sections){ensure(180,section.title);heading(section.title,section.subtitle);section.rows.forEach(metricRow);if(section.note){y+=10;paragraph(section.note,8);} }
  newPage("Report Guide");heading("How to Read This Report","Keep the sample and source beside the number");
  for(const note of report.notes)paragraph(note,10,colors.ink,false,17);
  paragraph(`Game sheets last updated: ${report.lastGameUpdate?day(exitMeetingPacificDate(report.lastGameUpdate)):"Not available"}. Report generated ${day(exitMeetingPacificDate(report.generatedAt))}. Meeting date is a label; it does not change the testing or reporting period.`,9);
  paragraph("Confidential player-development report. Share only with the selected player and authorized staff. PACU Baseball Performance is an independent project for Pacific Baseball; it is not an official university application.",9);
  const pages=pdf.getPages(); pages.forEach((p,index)=>{p.drawLine({start:{x:margin,y:43},end:{x:width-margin,y:43},thickness:.6,color:colors.line});p.drawText(textSafe(`${report.code} · PRIVATE PLAYER REPORT`),{x:margin,y:28,size:7,font:regular,color:colors.muted});p.drawText(`${index+1} / ${pages.length}`,{x:width-margin-35,y:28,size:7,font:bold,color:colors.muted});});
  return pdf.save();
}
