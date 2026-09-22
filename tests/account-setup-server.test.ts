import {beforeEach,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({requireAdminWorkspaceAccess:mock.guard}));
import {readAccountSetupStatuses} from "@/lib/account-setup-server";
beforeEach(()=>{vi.resetAllMocks();mock.guard.mockResolvedValue({supabase:{rpc:mock.rpc}});mock.rpc.mockResolvedValue({data:[],error:null});});
it("requires the strict administrator-outside-preview guard before querying",async()=>{
 mock.guard.mockRejectedValueOnce(new Error("denied"));await expect(readAccountSetupStatuses()).rejects.toThrow("denied");expect(mock.rpc).not.toHaveBeenCalled();
});
it("uses only the ordinary-session status RPC",async()=>{
 expect(await readAccountSetupStatuses()).toEqual([]);expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("admin_account_setup_status");
});
it("fails closed without exposing provider error details or returning false pending statuses",async()=>{
 mock.rpc.mockResolvedValue({data:[],error:{message:"private database detail"}});await expect(readAccountSetupStatuses()).rejects.toThrow("Unable to check invitation status");
});
