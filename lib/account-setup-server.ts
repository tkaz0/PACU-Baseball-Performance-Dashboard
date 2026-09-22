import "server-only";
import {requireAdminWorkspaceAccess} from "@/lib/auth";
import {parseAccountSetupStatuses} from "@/lib/account-setup-status";

export async function readAccountSetupStatuses(){
 const {supabase}=await requireAdminWorkspaceAccess();
 const {data,error}=await supabase.rpc("admin_account_setup_status");
 if(error)throw new Error("Unable to check invitation status. Refresh to try again.");
 return parseAccountSetupStatuses(data);
}
