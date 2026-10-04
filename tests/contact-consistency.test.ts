import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {contactConsistency} from "@/lib/contact-consistency";
import {ContactConsistency} from "@/components/contact-consistency";
it("partitions exact EV and launch-window boundaries once with complete paired denominators",()=>{
 const rows=[69,70,80,90,100,110].map((exitVelocity,i)=>({exitVelocity,launchAngle:[-11,-10,8,32,50,90][i]}));
 const {exitVelocity,launchAngle}=contactConsistency(rows);
 expect(exitVelocity!.bins.map(b=>b.count)).toEqual([1,1,1,1,1,1]);expect(launchAngle!.bins.map(b=>b.count)).toEqual([1,1,2,0,2]);
 for(const data of [exitVelocity!,launchAngle!]){expect(data.count).toBe(6);expect(data.bins.reduce((n,b)=>n+b.count,0)).toBe(6);expect(data.bins.reduce((n,b)=>n+b.share,0)).toBeCloseTo(100);}
});
it("computes arithmetic mean and interpolated middle 80% without changing input",()=>{
 const rows=[100,80,90].map(exitVelocity=>({exitVelocity,launchAngle:20})),copy=structuredClone(rows);
 const data=contactConsistency(rows).exitVelocity!;
 expect(data).toMatchObject({mean:90,min:80,max:100,p10:82,p90:98,count:3});expect(rows).toEqual(copy);
});
it("leaves missing or invalid paired readings out of both charts rather than inventing zeros",()=>{
 const rows=[{exitVelocity:90,launchAngle:20},{exitVelocity:NaN,launchAngle:20},{exitVelocity:80,launchAngle:Infinity},{exitVelocity:0,launchAngle:0},{exitVelocity:201,launchAngle:0},{exitVelocity:90,launchAngle:91}];
 const result=contactConsistency(rows);expect(result.exitVelocity!.count).toBe(1);expect(result.launchAngle!.count).toBe(1);expect(result.exitVelocity!.p10).toBe(90);
 expect(contactConsistency([])).toEqual({exitVelocity:null,launchAngle:null});
});
it("explains the sample, range and comparison without assigning a performance grade",()=>{
 const html=renderToStaticMarkup(createElement(ContactConsistency,{contacts:[{exitVelocity:88.456,launchAngle:18}]}));
 expect(html).toContain("88.5");expect(html).toContain("Early look");expect(html).toContain("not automatically mean better");expect(html).toContain("not confirmed hits");expect(html).toContain('aria-label="About contact consistency"');
 expect(html).not.toContain("Elite");expect(html).not.toContain('role="meter"');
 expect(renderToStaticMarkup(createElement(ContactConsistency,{contacts:[]}))).toContain("No paired");
});
