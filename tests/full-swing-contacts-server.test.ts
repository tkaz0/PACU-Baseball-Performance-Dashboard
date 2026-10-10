import { beforeEach, expect, it, vi } from "vitest";
const fake=vi.hoisted(()=>({from:vi.fn(),filter:vi.fn(),range:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({requireAccess:vi.fn(),requireImportAccess:vi.fn()}));
import { loadFullSwingContacts } from "@/lib/full-swing-contacts-server";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const row={file_hash:"a".repeat(64),source_row:2,pitch_number:1,source_file:"fictional.csv",played_on:"2026-09-11",category:"practice",exit_velocity:90,launch_angle:20,direction:5,distance:230};
const access={roles:["player" as const],athleteId:id,actualRoles:["player" as const],preview:null,user:{id:"fictional"},supabase:{from:fake.from,rpc:fake.rpc}};
beforeEach(()=>{vi.resetAllMocks();fake.rpc.mockImplementation(async()=>({data:[{file_hash:row.file_hash,source_row:2,pitch_type:"Slider",pitcher_throws:"R",squared_up:.9,potential_exit_velocity:100},{file_hash:row.file_hash,source_row:3,pitch_type:null,pitcher_throws:null,squared_up:null,potential_exit_velocity:null}],error:null}));const q={select:()=>q,eq:()=>q,in:fake.filter,order:()=>q,range:fake.range};fake.filter.mockReturnValue(q);fake.from.mockReturnValue(q);fake.range.mockResolvedValue({data:[row],error:null});});
it.each(["practice","in_game"] as const)("reads only the requested %s contact context",async context=>{
 fake.range.mockResolvedValue({data:[{...row,category:context==="practice"?"practice":"intrasquad"}],error:null});
 const contacts=await loadFullSwingContacts(access as never,id,context);
 expect(contacts).toHaveLength(1);expect(fake.filter).toHaveBeenCalledExactlyOnceWith("category",context==="practice"?["practice"]:["game","intrasquad"]);
});
it("fails closed if a filtered response contains the other context",async()=>{
 await expect(loadFullSwingContacts(access as never,id,"in_game")).rejects.toThrow("format is invalid");
});
it("denies other-player and Admin-as-Player contact reads before querying",async()=>{
 for(const current of [access,{...access,actualRoles:["admin"]}])await expect(loadFullSwingContacts(current as never,"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","practice")).rejects.toThrow("access denied");
 expect(fake.from).not.toHaveBeenCalled();
});
it("retains both contexts for existing report callers that request complete history",async()=>{
 fake.range.mockResolvedValue({data:[row,{...row,source_row:3,category:"game"}],error:null});
 expect(await loadFullSwingContacts(access as never,id)).toHaveLength(2);expect(fake.filter).not.toHaveBeenCalled();
});

it("merges exact-coordinate details in a single authorized call",async()=>{
 const [contact]=await loadFullSwingContacts(access as never,id,"practice");
 expect(contact).toMatchObject({pitchType:"Slider",pitcherThrows:"R",squaredUp:.9,potentialExitVelocity:100});
 expect(fake.rpc).toHaveBeenCalledExactlyOnceWith("athlete_contact_details",{p_athlete:id});
});
it("does not present failed or incomplete detail reads as unclassified contact",async()=>{
 fake.rpc.mockResolvedValueOnce({data:null,error:{code:"unavailable"}});
 await expect(loadFullSwingContacts(access as never,id)).rejects.toThrow("could not be loaded");
 fake.rpc.mockResolvedValueOnce({data:[],error:null});
 await expect(loadFullSwingContacts(access as never,id)).rejects.toThrow("coverage");
});
