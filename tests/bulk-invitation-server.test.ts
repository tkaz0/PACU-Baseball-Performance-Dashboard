import { beforeEach, it, expect, vi } from "vitest";
const fake=vi.hoisted(()=>({access:vi.fn(),from:vi.fn(),rpc:vi.fn(),directory:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({requireAdminWorkspaceAccess:fake.access}));
vi.mock("@/lib/supabase/auth-admin",()=>({invitationsEnabled:()=>true,createAuthAdministrator:()=>({listUsers:fake.directory})}));
import { prepareBulkInvitations } from "@/lib/bulk-invitation-server";
const athlete="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",attempt="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeEach(()=>{
  vi.resetAllMocks();fake.access.mockResolvedValue({user:{email:"fictional.admin@example.com"},supabase:{from:fake.from,rpc:fake.rpc}});
  fake.directory.mockResolvedValue({data:{users:[],nextPage:null},error:null});
  fake.from.mockImplementation(table=>{const data=table==="athletes"?[{id:athlete,athlete_code:"SYN-001",first_name:"Fictional",preferred_name:null,last_name:"Player",pacific_email:"fictional.new@example.com",athlete_seasons:[{season:"2026-27",roster_status:"active"}]}]:[];const chain={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn().mockResolvedValue({data,count:data.length,error:null})};for(const key of ["select","eq","order"] as const)chain[key].mockReturnValue(chain);return chain;});
});
it("pairs recovery with the attempted recipient instead of the corrected roster email",async()=>{
  fake.rpc.mockResolvedValue({data:[{id:attempt,athlete_id:athlete,status:"attempted",email:"fictional.old@example.com"}],error:null});
  expect((await prepareBulkInvitations())[0]).toMatchObject({status:"review",email:"fictional.new@example.com",attemptedEmail:"fictional.old@example.com",attemptId:attempt});
});
it("does not invent an original recipient when history is missing its email",async()=>{
  fake.rpc.mockResolvedValue({data:[{id:attempt,athlete_id:athlete,status:"attempted"}],error:null});
  expect((await prepareBulkInvitations())[0]).toMatchObject({status:"review",attemptedEmail:undefined});
});
it("denies history and directory reads before authorization",async()=>{
  fake.access.mockRejectedValue(Error("DENIED"));await expect(prepareBulkInvitations()).rejects.toThrow("DENIED");expect(fake.from).not.toHaveBeenCalled();expect(fake.rpc).not.toHaveBeenCalled();expect(fake.directory).not.toHaveBeenCalled();
});
