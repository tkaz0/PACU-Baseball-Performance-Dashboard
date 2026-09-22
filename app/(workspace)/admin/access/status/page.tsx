import Link from "next/link";
import {PageHeading} from "@/components/page-heading";
import {AccountSetupTable} from "@/components/account-setup-table";
import {readAccountSetupStatuses} from "@/lib/account-setup-server";

export const dynamic="force-dynamic";
export default async function AccountSetupPage(){
 const accounts=await readAccountSetupStatuses();
 return <><PageHeading section="Account Access" title="Invitation Status" description="See who accepted their invitation, set a password, and signed in."><Link href="/admin/access" className="btn btn-secondary">Account Access</Link></PageHeading><AccountSetupTable accounts={accounts}/></>;
}
