import {beforeEach,expect,it,vi} from "vitest";
const fake=vi.hoisted(()=>({guard:vi.fn(),enabled:vi.fn(),directory:vi.fn(),send:vi.fn(),rpc:vi.fn(),privilegedRpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({requireAdminMutation:fake.guard}));
vi.mock("@/lib/env",()=>({appUrl:()=>"https://fictional.example.com"}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/supabase/auth-admin",()=>({invitationsEnabled:fake.enabled,createAuthAdministrator:()=>({listUsers:fake.directory,inviteUserByEmail:fake.send,rpc:fake.privilegedRpc})}));
import {sendBulkPlayerInvite} from "@/app/(workspace)/admin/access/bulk/actions";
// Fictional recipients. All provider and database calls are mocked; no emails are sent.
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",user="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",claim="cccccccc-cccc-4ccc-8ccc-cccccccccccc",email="fictional@example.com";
beforeEach(()=>{
 vi.resetAllMocks();fake.enabled.mockReturnValue(true);fake.guard.mockResolvedValue({supabase:{rpc:fake.rpc}});
 fake.directory.mockResolvedValue({data:{users:[],nextPage:null},error:null});
 fake.send.mockResolvedValue({data:{user:{id:user,email}},error:null});
 fake.rpc.mockImplementation(async(name:string)=>({data:name==="admin_claim_player_invite"?{claimed:true,id:claim}:null,error:null}));
});
it("requires confirmation and valid exact choices before provider access",async()=>{
 for(const args of [[athlete,email,false],["invalid",email,true],[athlete,"bad",true]] as const)expect((await sendBulkPlayerInvite(args[0],args[1],args[2])).status).toBe("review");
 expect(fake.directory).not.toHaveBeenCalled();expect(fake.send).not.toHaveBeenCalled();
});
it("rejects revoked or preview access before any provider or database operation",async()=>{
 fake.guard.mockRejectedValue(new Error("forbidden"));await expect(sendBulkPlayerInvite(athlete,email,true)).rejects.toThrow("forbidden");
 expect(fake.directory).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();
});
it.each(["existing","unavailable","claimed","changed"])("never sends for %s recipients",async reason=>{
 if(reason==="existing")fake.directory.mockResolvedValue({data:{users:[{email}],nextPage:null},error:null});
 if(reason==="unavailable")fake.directory.mockRejectedValue(new Error("private provider detail"));
 if(reason==="claimed")fake.rpc.mockResolvedValue({data:{claimed:false},error:null});
 if(reason==="changed")fake.rpc.mockResolvedValue({data:null,error:{message:"private detail"}});
 expect((await sendBulkPlayerInvite(athlete,email,true)).status).toBe(["existing","claimed"].includes(reason)?"skipped":"review");expect(fake.send).not.toHaveBeenCalled();
});
it("checks permission again immediately before email after reserving",async()=>{
 fake.guard.mockResolvedValueOnce({supabase:{rpc:fake.rpc}}).mockResolvedValueOnce({supabase:{rpc:fake.rpc}}).mockRejectedValueOnce(new Error("revoked"));
 expect((await sendBulkPlayerInvite(athlete,email,true)).status).toBe("review");expect(fake.send).not.toHaveBeenCalled();
});
it.each(["timeout","wrong-user","provision","receipt"])("stops after %s uncertainty without retry",async reason=>{
 if(reason==="timeout")fake.send.mockRejectedValue(new Error("private detail"));
 if(reason==="wrong-user")fake.send.mockResolvedValue({data:{user:{id:user,email:"other@example.com"}},error:null});
 if(reason==="provision"||reason==="receipt")fake.rpc.mockImplementation(async(name:string)=>({data:name==="admin_claim_player_invite"?{claimed:true,id:claim}:null,error:name===(reason==="provision"?"admin_provision_invited_account":"admin_finish_player_invite")?{message:"private detail"}:null}));
 const result=await sendBulkPlayerInvite(athlete,email,true);expect(result.status).toBe("review");expect(result.message).not.toContain("private detail");expect(fake.send).toHaveBeenCalledTimes(1);expect(fake.privilegedRpc).not.toHaveBeenCalled();
 if(["timeout","wrong-user"].includes(reason))expect(fake.rpc).toHaveBeenCalledTimes(1);
});
it("sends once and provisions only Player access through fresh ordinary sessions",async()=>{
 expect((await sendBulkPlayerInvite(athlete,email,true)).status).toBe("sent");
 expect(fake.send).toHaveBeenCalledExactlyOnceWith(email,{redirectTo:"https://fictional.example.com/auth/confirm"});
 expect(fake.rpc.mock.calls).toEqual([["admin_claim_player_invite",{p_athlete:athlete,p_email:email}],["admin_provision_invited_account",{target_user:user,account_role:"player",linked_athlete:athlete}],["admin_finish_player_invite",{p_attempt:claim}]]);
 expect(fake.guard).toHaveBeenCalledTimes(5);expect(fake.privilegedRpc).not.toHaveBeenCalled();
});
