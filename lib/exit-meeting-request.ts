import "server-only";
import { ExitMeetingError } from "@/lib/exit-meeting-server";
export const EXIT_MEETING_PRIVATE_HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export const exitMeetingErrorResponse=(error:string,status:number)=>Response.json({error},{status,headers:EXIT_MEETING_PRIVATE_HEADERS});
export async function readExitMeetingRequest(request:Request):Promise<unknown>{
 if(request.headers.get("origin")!==new URL(request.url).origin)throw new ExitMeetingError("Open Exit Meetings on the dashboard to continue.",403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))throw new ExitMeetingError("Review your meeting options and try again.",400);
 const reader=request.body?.getReader();if(!reader)throw new ExitMeetingError("Choose a player first.",400);
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>12000){await reader.cancel();throw new ExitMeetingError("Meeting notes are too long.",413);}chunks.push(chunk.value);}
 try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new ExitMeetingError("Review your meeting options and try again.",400);}
}
