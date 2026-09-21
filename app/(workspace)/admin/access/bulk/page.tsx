import Link from "next/link";
import {PageHeading} from "@/components/page-heading";
import {BulkInviteForm} from "@/components/bulk-invite-form";
import {prepareBulkInvitations} from "@/lib/bulk-invitation-server";
export default async function Page(){const players=await prepareBulkInvitations();return <><PageHeading section="Team Rollout" title="Invite the Team" description="Review the remaining players, then send their password-setup emails together."><Link href="/admin/access" className="btn btn-secondary">Account Access</Link></PageHeading><BulkInviteForm players={players}/></>}
