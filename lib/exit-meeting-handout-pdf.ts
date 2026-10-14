import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, Duplex, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { exitMeetingPacificDate, type ExitMeetingInsight, type ExitMeetingOptions, type ExitMeetingReport, type ExitMeetingRow, type ExitMeetingSection } from "@/lib/exit-meeting";

const C = { ink: rgb(.10,.13,.18), muted: rgb(.36,.40,.45), red: rgb(.67,.06,.14), blue: rgb(.15,.40,.66), green: rgb(.12,.42,.31), line: rgb(.85,.87,.89), pale: rgb(.965,.97,.975), white: rgb(1,1,1) };
const W=612, H=792, M=38, CW=W-2*M, GAP=20, COL=(CW-GAP)/2, BOTTOM=722;
const safe=(v:string)=>v.normalize("NFC").replace(/[′’‘]/g,"'").replace(/[″“”]/g,'"').replace(/[−–—]/g,"-").replace(/→/g,"to").replace(/\u00a0/g," ").replace(/[^\x20-\x7e\u00a1-\u00ff\n]/g,"?");
function lines(value:string,font:PDFFont,size:number,width:number):string[]{
  const result:string[]=[];
  for(const paragraph of safe(value).split("\n")){
    let line="";
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      if(font.widthOfTextAtSize(line?`${line} ${word}`:word,size)<=width){line=line?`${line} ${word}`:word;continue;}
      if(line)result.push(line);line="";
      for(const ch of word){if(line&&font.widthOfTextAtSize(line+ch,size)>width){result.push(line);line="";}line+=ch;}
    }
    result.push(line);
  }
  return result;
}
const date=(v:string)=>/^\d{4}-\d\d-\d\d$/.test(v)?new Date(`${v}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",...(v.startsWith("2026-")?{}:{year:"numeric" as const}),timeZone:"UTC"}):v;
const dateRange=(v:string)=>v.split(" to ").map(date).join(" - ");
const compact=(v:string)=>v.replace(/plate appearances/g,"PA").replace(/classified contacts/g,"classified contact").replace(/velocity readings/g,"velo readings").replace(/Fall weighted average \/ best/g,"Fall weighted avg / best").replace(/Fall weighted average/g,"Fall weighted avg").replace(/Latest saved profile results/g,"Latest results").replace(/Latest profile result/g,"Latest result").replace(/Updated snapshot/g,"Updated");
const isArsenal=(s:ExitMeetingSection)=>s.id.startsWith("arsenal");
const isPitching=(s:ExitMeetingSection)=>isArsenal(s)||/pitching|pitch-grades|contact-allowed/.test(s.id);
const onBack=(s:ExitMeetingSection)=>s.id==="physicality"||s.id==="testing";

/** A duplex meeting handout. Overflow is explicit and lossless, including old saved models. */
export async function createExitMeetingHandoutPdf(report:ExitMeetingReport,options:ExitMeetingOptions):Promise<Uint8Array>{
  const pdf=await PDFDocument.create();
  pdf.catalog.getOrCreateViewerPreferences().setDuplex(Duplex.DuplexFlipLongEdge);
  pdf.setTitle(`PACU Baseball Exit Meeting - ${report.name}`);pdf.setAuthor("PACU Baseball Performance");pdf.setSubject("Private player development meeting");
  const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const svg=await readFile(path.join(process.cwd(),"app/icon.svg"),"utf8");
  const paths=[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);if(!paths.length)throw new Error("The report brand asset could not be loaded.");
  let page:PDFPage;
  const text=(v:string,x:number,top:number,size=9,strong=false,color:RGB=C.ink)=>page.drawText(safe(v),{x,y:H-top-size,size,font:strong?bold:font,color});
  const rule=(x:number,top:number,w:number,color:RGB=C.line)=>page.drawLine({start:{x,y:H-top},end:{x:x+w,y:H-top},thickness:.65,color});
  const box=(x:number,top:number,w:number,h:number,color:RGB=C.pale)=>page.drawRectangle({x,y:H-top-h,width:w,height:h,color});
  const block=(v:string,x:number,top:number,w:number,size=8,strong=false,color:RGB=C.muted,leading=size+3)=>{const ls=lines(v,strong?bold:font,size,w);ls.forEach((l,i)=>text(l,x,top+i*leading,size,strong,color));return ls.length*leading;};
  function newPage(kicker:string,title:string,front=false){
    page=pdf.addPage([W,H]);box(0,0,W,5,C.red);
    const scale=26/124;for(const p of paths)page.drawSvgPath(p,{x:M-124*scale,y:H-24-5*scale,scale,color:C.red});
    text("PACIFIC BASEBALL",M+34,24,9,true,C.red);text("PLAYER DEVELOPMENT",M+34,38,7.5,false,C.muted);
    const right=`${report.season.toUpperCase()}  /  ${kicker.toUpperCase()}`;text(right,W-M-bold.widthOfTextAtSize(safe(right),7.5),29,7.5,true,C.muted);rule(M,58,CW);
    let top=73;
    if(front){
      top+=block(report.name,M,top,CW,27,true,C.ink,30)+5;
      top+=block([report.jersey,report.position,report.academicClass,report.batsThrows].filter(Boolean).join("  ·  "),M,top,CW,9,true,C.muted,12)+7;
      text(`${report.code}  ·  Meeting ${date(options.meetingDate)}, ${options.meetingDate.slice(0,4)}`,M,top,8,false,C.muted);top+=24;
    }else{top+=block(title,M,top,CW,22,true,C.ink,26)+5;top+=block(`${report.name}  ·  ${report.code}  ·  Meeting ${date(options.meetingDate)}`,M,top,CW,8,false,C.muted,11)+15;}
    return top;
  }
  function rank(r:Pick<ExitMeetingRow,"percentile"|"peers">,x:number,top:number,w=52){
    if(r.percentile===null){text("No team rank",x,top,7,false,C.muted);return 0;}
    const stops=[C.blue,rgb(.66,.79,.90),rgb(.89,.90,.91),rgb(.86,.60,.63),C.red];
    stops.forEach((c,i)=>box(x+i*w/5,top+3,w/5+.1,4,c));
    const p=x+w*Math.min(100,Math.max(0,r.percentile))/100;
    page.drawCircle({x:p,y:H-top-5,size:3.2,color:C.ink,borderColor:C.white,borderWidth:.8});
    text(`P${Math.round(r.percentile)}${r.peers===null?"":` / ${r.peers}`}`,x+w+7,top,7.2,true,C.muted);return w+45;
  }
  type Task={section:ExitMeetingSection;rows:ExitMeetingRow[]};
  const overflow:Task[]=[];
  function section(s:ExitMeetingSection,x:number,top:number,w:number,limit=BOTTOM,allowOverflow=true):number{
    if(!s.rows.length)return top;
    const common=(key:"source"|"date"|"basis"|"sample"|"peers")=>s.rows.every(r=>r[key]===s.rows[0][key])?s.rows[0][key]:null;
    const source=common("source"),d=common("date"),basis=common("basis"),sample=common("sample"),peers=common("peers");
    const title=lines(s.title,bold,11,w-10);
    const context=[source,d?dateRange(String(d)):null,basis?compact(String(basis)):null,sample?compact(String(sample)):null,peers?`${peers} teammates`:null].filter(Boolean).join(" · ");
    const contextLines=lines(context||s.subtitle,font,7.2,w);
    const refs:string[]=[];
    const layouts=s.rows.map(r=>{
      const meta=[source?null:r.source,d?null:dateRange(r.date),basis?null:compact(r.basis),sample?null:r.sample?compact(r.sample):null,peers||r.peers===null?null:`${r.peers} teammates`].filter(Boolean).join(" · ");
      if(meta&&!refs.includes(meta))refs.push(meta);
      const ref=meta?refs.indexOf(meta)+1:null;
      const label=lines(`${r.label}${ref?` [${ref}]`:""}`,bold,8.5,w-122),value=lines(r.value,bold,10,68);
      return {r,label,value,h:Math.max(label.length*10.5,value.length*12,14)+4};
    });
    const refsText=refs.map((v,i)=>`[${i+1}] ${v}`).join("  ·  ");
    let foot=refsText?lines(refsText,font,7.2,w):[];
    if(foot.length*9>100){extraNotes.push(`${s.title} result references: ${refsText}`);foot=["Result references continue in Report Context."];}
    const head=title.length*13+contextLines.length*9+10;
    if(top+head+layouts[0].h+foot.length*9>limit&&allowOverflow){overflow.push({section:s,rows:s.rows});return top;}
    box(x,top,3,13,C.red);title.forEach((l,i)=>text(l,x+10,top+i*13,11,true));top+=title.length*13+4;
    contextLines.forEach(l=>{text(l,x,top,7.2,false,C.muted);top+=9;});top+=6;
    for(let i=0;i<layouts.length;i++){
      const l=layouts[i];if(top+l.h+foot.length*9>limit&&allowOverflow){overflow.push({section:s,rows:s.rows.slice(i)});text("Continued in additional results",x,top,7.3,true,C.red);top+=13;break;}
      if(i%2===0)box(x-3,top-2,w+6,l.h,C.pale);
      if(l.r.tone&&l.r.tone!=="none")box(x-3,top-2,2,l.h,l.r.tone==="red"?C.red:l.r.tone==="green"?C.green:rgb(.72,.48,.08));
      l.label.forEach((v,j)=>text(v,x+4,top+j*10.5,8.5,true));
      l.value.forEach((v,j)=>text(v,x+w-53-bold.widthOfTextAtSize(safe(v),10),top-1+j*12,10,true));
      if(l.r.percentile!==null){const p=Math.min(100,Math.max(0,l.r.percentile));box(x+w-43,top+3,20,4,C.line);box(x+w-43,top+3,20*p/100,4,p>=50?C.red:C.blue);text(`P${Math.round(p)}`,x+w-19,top,7,true,p>=50?C.red:C.blue);}
      else text("-",x+w-12,top,8,false,C.muted);
      top+=l.h;
    }
    for(const l of foot){text(l,x,top+3,7.2,false,C.muted);top+=9;}top+=4;
    if(s.note){const h=lines(s.note,font,7.2,w).length*9.5;if(top+h+3<=limit){top+=block(s.note,x,top+3,w,7.2,false,C.muted,9.5)+3;}else if(allowOverflow)extraNotes.push(`${s.title}: ${s.note}`);}
    return top+13;
  }
  const extraNotes:string[]=[];
  // Matching is display-only. Unknown and historical row shapes use the lossless regular section renderer.
  function arsenal(s:ExitMeetingSection,x:number,top:number,w:number,limit=BOTTOM):number{
    const matches=s.rows.map(r=>({r,m:r.label.match(/^(.*) · (Velocity|Spin)$/),v:r.value.match(/^([\d.,]+|—|-) avg \/ ([\d.,]+|—|-) max (mph|rpm)$/)}));
    if(matches.some(v=>!v.m||!v.v||v.r.percentile!==null||v.r.tone&&v.r.tone!=="none"||v.m[2]==="Velocity"&&v.v[3]!=="mph"||v.m[2]==="Spin"&&v.v[3]!=="rpm"))return section(s,x,top,w,limit);
    const shared=(key:"date"|"basis"|"source")=>s.rows.every(r=>r[key]===s.rows[0][key])?s.rows[0][key]:null;
    const commonDate=shared("date"),commonBasis=shared("basis"),commonSource=shared("source");
    if(!commonSource)return section(s,x,top,w,limit);
    const sampleFor=(family:string)=>{const rows=matches.filter(i=>i.m![2]===family);return rows.length&&rows.every(i=>i.r.sample===rows[0].r.sample)?rows[0].r.sample:null;};
    const velocitySample=sampleFor("Velocity"),spinSample=sampleFor("Spin");
    const groups=new Map<string,typeof matches>();for(const item of matches){const key=item.m![1];groups.set(key,[...(groups.get(key)??[]),item]);}
    if([...groups.values()].some(g=>new Set(g.map(i=>i.m![2])).size!==g.length))return section(s,x,top,w,limit);
    const title=lines(s.title,bold,11,w-10);const heads=lines([commonSource||s.subtitle,commonDate?dateRange(commonDate):null,commonBasis?compact(commonBasis):null].filter(Boolean).join(" · "),font,7.3,w);const headH=title.length*13+heads.length*10+24;
    if(top+headH+55>limit){overflow.push({section:s,rows:s.rows});return top;}
    box(x,top,3,13,C.red);title.forEach((v,i)=>text(v,x+10,top+i*13,11,true));top+=title.length*13+4;
    heads.forEach(v=>{text(v,x,top,7.3,false,C.muted);top+=10;});top+=4;
    const numberX=[x+w-146,x+w-105,x+w-64,x+w-4];
    text("PITCH",x,top+11,7,true,C.muted);
    text("VELOCITY (mph)",x+w-169,top,7,true,C.muted);text("SPIN (rpm)",x+w-79,top,7,true,C.muted);
    ["AVG","MAX","AVG","MAX"].forEach((v,i)=>text(v,numberX[i]-bold.widthOfTextAtSize(v,6.8),top+12,6.8,true,C.muted));top+=21;
    const footer=[...(velocitySample?[`Velocity: ${compact(velocitySample)}`]:[]),...(spinSample?[`Spin: ${compact(spinSample)}`]:[]),...(s.note?[s.note]:[])];
    const footerHeight=footer.reduce((h,v)=>h+lines(v,font,7.2,w).length*9.5,0)+10;
    const entries=[...groups.entries()];
    for(let n=0;n<entries.length;n++){
      const [name,items]=entries[n];
      const nameLines=lines(name,bold,8.5,w-178);const metas=items.flatMap(i=>{const meta=[commonDate?null:dateRange(i.r.date), (i.m![2]==="Velocity"?velocitySample:spinSample)?null:compact(i.r.sample??"Reading count unavailable"),commonBasis?null:i.r.basis].filter(Boolean).join(" · ");return meta?[lines(`${i.m![2]}: ${meta}`,font,7.1,w-8)]:[];});
      const h=Math.max(nameLines.length*11,16)+metas.reduce((a,b)=>a+b.length*9,0)+5;
      if(top+h+footerHeight>limit){
        overflow.push({section:s,rows:entries.slice(n).flatMap(e=>e[1].map(i=>i.r))});
        text("Continued in additional results",x,top,7.3,true,C.red);top+=13;
        for(const note of footer){if(top+lines(note,font,7.2,w).length*9.5<=limit)top+=block(note,x,top,w,7.2,false,C.muted,9.5);else extraNotes.push(`${s.title}: ${note}`);}
        return top+10;
      }
      if(n%2===0)box(x-3,top-3,w+6,h,C.pale);
      nameLines.forEach((v,i)=>text(v,x+4,top+i*11,8.5,true));
      for(const [family,offset] of [["Velocity",0],["Spin",2]] as const){
        const item=items.find(i=>i.m![2]===family);
        for(let i=0;i<2;i++){const v=item?.v?.[i+1]??"-";text(v,numberX[offset+i]-bold.widthOfTextAtSize(safe(v),10),top,10,true);}
      }
      top+=Math.max(nameLines.length*11,16);
      for(const ls of metas)for(const l of ls){text(l,x+4,top,7.1,false,C.muted);top+=9;}top+=5;
    }
    for(const note of footer)top+=block(note,x,top,w,7.2,false,C.muted,9.5);
    top+=10;
    return top;
  }
  const baseball=report.sections.filter(s=>!onBack(s));
  const hit=baseball.filter(s=>!isPitching(s)),pitch=baseball.filter(isPitching);
  const start=newPage("01 / Scorecard","",true);
  // Keep a two-way player's hitting and pitching on opposite sides without relying on roster position text.
  let left=start,right=start;
  let leftSections:ExitMeetingSection[],rightSections:ExitMeetingSection[];
  if(hit.length&&pitch.length){leftSections=hit;rightSections=pitch;}
  else{const all=hit.length?hit:pitch;leftSections=all.filter(s=>s.id.startsWith("game-")||s.id==="hitting-in_game"||s.id==="hitting");rightSections=all.filter(s=>!leftSections.includes(s));if(!leftSections.length){leftSections=all.slice(0,1);rightSections=all.slice(1);}}
  const render=(s:ExitMeetingSection,x:number,y:number)=>isArsenal(s)?arsenal(s,x,y,COL):section(s,x,y,COL);
  for(const s of leftSections)left=render(s,M,left);
  for(const s of rightSections)right=render(s,M+COL+GAP,right);
  const snapshotKeys=new Set(["batting_production_plus","batting_obp","qpa_pct","avg_exit_velocity","avg_bat_speed","pitching_whip","pitching_k_bb","pitching_r9","strike_pct","pitching_k9"]);
  const snapshotRows=baseball.flatMap(s=>s.rows).filter(r=>r.metricKey&&snapshotKeys.has(r.metricKey)&&r.percentile!==null&&(r.peers??0)>=5&&bold.widthOfTextAtSize(safe(r.label),8.5)<=COL-38).slice(0,6);
  const chartTop=Math.max(left,right)+8,chartHeight=26+Math.ceil(snapshotRows.length/2)*37;
  if(snapshotRows.length>=2&&chartTop+chartHeight<=710&&!overflow.length){
    rule(M,chartTop,CW);text("TEAM RANK SNAPSHOT",M,chartTop+12,8,true,C.red);
    snapshotRows.forEach((r,i)=>{
      const x=M+(i%2)*(COL+GAP),top=chartTop+32+Math.floor(i/2)*37;
      text(r.label,x,top,8.5,true);text(`P${Math.round(r.percentile!)}`,x+COL-26,top,8.5,true,r.percentile!>=50?C.red:C.blue);
      const stops=[C.blue,rgb(.66,.79,.90),rgb(.89,.90,.91),rgb(.86,.60,.63),C.red],barTop=top+15,barW=COL-42;
      stops.forEach((c,j)=>box(x+j*barW/5,barTop,barW/5+.1,5,c));
      page.drawCircle({x:x+barW*r.percentile!/100,y:H-barTop-2.5,size:3.5,color:C.ink,borderColor:C.white,borderWidth:.8});
      text(`n=${r.peers}`,x+COL-31,barTop-1,7,false,C.muted);
    });
  }
  if(!baseball.length){block("Your Fall scorecard",M,start,CW,18,true,C.ink);block("Game and practice results will appear here as they are recorded. Missing results are never treated as zero.",M,start+34,CW,11,false,C.muted,16);}
  // Fixed legend makes small visual rank marks understandable without repeating a paragraph for every stat.
  rule(M,734,CW);text("TEAM RANK",M,741,7,true,C.muted);rank({percentile:75,peers:null},M+63,741,55);text("P75 = 75th percentile. Blue lower · Red higher. - = no rank.",M+172,741,7,false,C.muted);

  let y=newPage("02 / Takeaways","Keep Building");
  function insights(title:string,items:ExitMeetingInsight[],empty:string,x:number,top:number,w:number,color:RGB){
    box(x,top,w,3,color);text(title.toUpperCase(),x,top+12,9,true,color);let cursor=top+32;
    if(!items.length)return cursor+block(empty,x,cursor,w,9,false,C.muted,12)+12;
    const fullHeight=items.reduce((h,item)=>h+lines(item.label,bold,10,w-46).length*12+lines(item.detail,font,8,w).length*10.5+17,0);
    const compactHighlights=fullHeight>160;
    if(compactHighlights)extraNotes.push(`${title}: ${items.map(item=>`${item.label}${item.percentile===null?"":` · P${Math.round(item.percentile)}`} · ${item.detail}`).join("; ")}`);
    for(const item of items){
      cursor+=block(item.label,x,cursor,w-46,10,true,C.ink,12);
      if(item.percentile!==null){text(`P${Math.round(item.percentile)}`,x+w-35,cursor-12,10,true,color);}
      if(!compactHighlights)cursor+=block(item.detail,x,cursor+4,w,8,false,C.muted,10.5)+9;else cursor+=10;
      if(item.percentile!==null){rank({percentile:item.percentile,peers:null},x,cursor,88);cursor+=16;}else cursor+=4;
    }
    if(compactHighlights)cursor+=block("Full highlight evidence continues in Report Context.",x,cursor,w,8,false,C.muted,10.5)+12;
    return cursor;
  }
  const iy=y;
  const h1=insights("Strengths",report.strengths,"No top-quarter strength is established yet. Keep collecting comparable results.",M,iy,COL,C.red);
  const h2=insights("Development Areas",report.development,"No measured baseball stat currently falls in the bottom team quarter. Missing data is not a weakness.",M+COL+GAP,iy,COL,C.blue);
  y=Math.max(h1,h2)+7;
  if(report.jumps.length){
    text("PROGRESS TO BUILD ON",M,y,8,true,C.green);y+=16;
    for(const item of report.jumps){
      const detail=`${item.label}  ·  ${item.detail}`;
      if(lines(detail,font,8.5,CW).length>3){extraNotes.push(`Progress to build on: ${detail}`);y+=block(`${item.label} · Full progress evidence continues in Report Context.`,M,y,CW,8.5,false,C.ink,11)+4;}
      else y+=block(detail,M,y,CW,8.5,false,C.ink,11)+4;
    }y+=8;
  }
  const backStart=y;
  const bodies=report.sections.filter(onBack);
  let bLeft=backStart,bRight=backStart;
  for(const s of bodies){if(s.id==="physicality")bLeft=section(s,M,bLeft,COL,520);else bRight=section(s,M+COL+GAP,bRight,COL,520);}
  y=Math.max(bLeft,bRight,backStart)+4;
  if(y<480)y=Math.max(y,440);
  text("MEETING TAKEAWAYS",M,y,9,true,C.red);y+=17;
  const noteLines=options.talkingPoints?lines(options.talkingPoints,font,9,CW-20):[];
  const noteRoom=Math.max(0,Math.min(95,600-y));
  const noteFits=noteLines.length*12+16<=noteRoom;
  if(noteLines.length&&noteFits){box(M,y,CW,noteLines.length*12+16);noteLines.forEach((l,i)=>text(l,M+10,y+8+i*12,9));y+=noteLines.length*12+26;}
  else if(noteLines.length){text("Coach talking points continue after this two-page handout.",M,y,8,false,C.muted);y+=20;}
  else{for(const label of ["Keep doing","Focus next","Check-in"]){text(label,M,y,8,true,C.muted);rule(M+62,y+11,CW-62);y+=23;}y+=2;}
  // Full model notes are preserved; extra-long historical notes receive explicit continuation pages.
  const guide=[...report.notes,...(report.missing.length?[`Still to add: ${report.missing.join(" · ")}. Missing is not zero.`]:[]),`Game sheets updated ${report.lastGameUpdate?date(exitMeetingPacificDate(report.lastGameUpdate)):"not available"}. Generated ${date(exitMeetingPacificDate(report.generatedAt))}. Meeting date does not change the data period. Independent Pacific Baseball project.`];
  rule(M,y,CW);y+=10;
  for(let i=0;i<guide.length;i++){
    const h=lines(guide[i],font,7.2,CW).length*9.2+4;
    if(y+h>722){extraNotes.push(...guide.slice(i));text("Report context continues in additional results.",M,y,7.2,true,C.red);break;}
    y+=block(guide[i],M,y,CW,7.2,false,C.muted,9.2)+4;
  }
  if(noteLines.length&&!noteFits){
    let top=newPage("Notes","Coach Talking Points");
    for(const l of noteLines){if(top+12>BOTTOM)top=newPage("Notes","Coach Talking Points · Continued");text(l,M,top,9);top+=12;}
  }
  if(overflow.length){
    let top=newPage("Additional Results","Additional Results");
    while(overflow.length){
      const task=overflow.shift()!;
      const current={...task.section,rows:task.rows};
      if(top>600)top=newPage("Additional Results","Additional Results · Continued");
      const next=section(current,M,top,CW,BOTTOM);
      if(next===top)top=newPage("Additional Results","Additional Results · Continued");else top=next;
    }
  }
  if(extraNotes.length){
    let top=newPage("Report Guide","Report Context");
    for(const note of extraNotes){for(const l of lines(note,font,8.5,CW)){if(top+12>BOTTOM)top=newPage("Report Guide","Report Context · Continued");text(l,M,top,8.5,false,C.muted);top+=12;}top+=7;}
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>{page=p;text(`${report.code} · PRIVATE PLAYER REPORT`,M,764,7,false,C.muted);const label=`${i+1} / ${pages.length}`;text(label,W-M-bold.widthOfTextAtSize(label,7),764,7,true,C.muted);});
  return pdf.save();
}
