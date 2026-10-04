import { expect, it, vi } from "vitest";
import { createReadLimiter } from "@/lib/limited-reads";
it("shares a three-read budget across callers, releases failures and retains result order",async()=>{
 const read=createReadLimiter(3), releases=new Map<number,()=>void>();let active=0,peak=0;
 const pending=Array.from({length:8},(_,i)=>read(async()=>{active++;peak=Math.max(peak,active);try{await new Promise<void>(resolve=>releases.set(i,resolve));if(i===1)throw Error("fictional unavailable");return i;}finally{active--;}}));
 const result=Promise.allSettled(pending);
 await vi.waitFor(()=>expect(releases.size).toBe(3));expect(active).toBe(3);
 for(let i=0;i<8;i++){await vi.waitFor(()=>expect(releases.has(i)).toBe(true));releases.get(i)!();}
 const settled=await result;expect(peak).toBe(3);expect(active).toBe(0);
 expect(settled.map((r,i)=>r.status==="fulfilled"?r.value:i)).toEqual([0,1,2,3,4,5,6,7]);expect(settled[1].status).toBe("rejected");
 expect(await read(async()=>9)).toBe(9);
});
it.each([0,5,-1,1.5,NaN])("rejects an invalid concurrency budget %s",limit=>expect(()=>createReadLimiter(limit)).toThrow());
