"use server";
import {requireAdminMutation} from "@/lib/auth";
import {createAuthAdministrator,invitationsEnabled} from "@/lib/supabase/auth-admin";
import {emailIsNew} from "@/lib/account-invitation";
import {validBulkEmail,type BulkInviteOutcome} from "@/lib/bulk-invitations";
import {UUID_PATTERN} from "@/lib/types";
import {appUrl} from "@/lib/env";
import {revalidatePath} from "next/cache";
export async function sendBulkPlayerInvite(athleteId:string,email:string,confirmed:boolean):Promise<BulkInviteOutcome>{
 await requireAdminMutation();
 if(confirmed!==true||typeof athleteId!=="string"||!UUID_PATTERN.test(athleteId)||typeof email!=="string"||!validBulkEmail(email)||!invitationsEnabled())return{status:"review",message:"Review the player and email before sending."};
 const administrator=createAuthAdministrator();
 let directory:"new"|"existing"|"unavailable"="unavailable";
 try{directory=await emailIsNew(email,page=>administrator.listUsers({page,perPage:100}));}catch{/* No send on incomplete directory reads. */}
 if(directory==="existing")return{status:"skipped",message:"Sign-in already exists. No duplicate invitation sent."};
 if(directory!=="new")return{status:"review",message:"Account directory unavailable. Batch paused before sending."};
 const current=await requireAdminMutation();
 // A durable, unique claim prevents double clicks, another tab or retries from resending.
 const {data:claim,error:claimError}=await current.supabase.rpc("admin_claim_player_invite",{p_athlete:athleteId,p_email:email});
 if(claimError)return{status:"review",message:"Player details changed or need review. No invitation sent."};
 if(!claim?.claimed)return{status:"skipped",message:"Already linked or previously attempted. No invitation sent."};
 if(typeof claim.id!=="string"||!UUID_PATTERN.test(claim.id))return{status:"review",message:"Send reservation could not be verified. Batch paused."};
 let invitedId:string|null=null;let rateLimited=false;
 try{
  await requireAdminMutation();
  const {data,error}=await administrator.inviteUserByEmail(email,{redirectTo:`${appUrl()}/auth/confirm`});
  rateLimited=error?.status===429&&error.code==="over_email_send_rate_limit";
  if(!error&&data.user&&UUID_PATTERN.test(data.user.id)&&data.user.email?.toLowerCase()===email)invitedId=data.user.id;
 }catch{/* A timeout may have sent the email. Keep the claim; do not retry. */}
 if(rateLimited){
  try{const active=await requireAdminMutation();const {error}=await active.supabase.rpc("admin_mark_player_invite_rejected",{p_attempt:claim.id,p_athlete:athleteId,p_email:email});if(error)throw new Error();}
  catch{return{status:"review",message:"Email limit reached. No email sent; this blocked attempt needs review."};}
  return{status:"limited",message:"Email limit reached. No email was sent to this player. Wait about an hour, then refresh this page and confirm the remaining invitations."};
 }
 if(!invitedId)return{status:"review",message:"Delivery was not confirmed. Batch paused; check this invitation before continuing."};
 let configured=false;
 try{const active=await requireAdminMutation();const {error}=await active.supabase.rpc("admin_provision_invited_account",{target_user:invitedId,account_role:"player",linked_athlete:athleteId});configured=!error;}catch{/* Never resend a partially configured invitation. */}
 if(!configured)return{status:"review",message:"Email sent; account access needs review. Batch paused."};
 try{const active=await requireAdminMutation();const {error}=await active.supabase.rpc("admin_finish_player_invite",{p_attempt:claim.id});if(error)throw new Error();}catch{return{status:"review",message:"Email and access were configured, but the receipt needs review. Batch paused."};}
 revalidatePath("/admin/access");revalidatePath("/admin/rollout");
 return{status:"sent",message:"Invitation sent · Player access configured"};
}

// Explicit administrator review is required for historical attempts with no saved provider code.
export async function prepareRejectedPlayerInvite(attemptId:string,athleteId:string,email:string,confirmed:boolean):Promise<{ok:boolean;message:string}>{
 await requireAdminMutation();
 if(confirmed!==true||!UUID_PATTERN.test(attemptId)||!UUID_PATTERN.test(athleteId)||!validBulkEmail(email)||!invitationsEnabled())return{ok:false,message:"Confirm that the provider rejected this invitation before any email was sent."};
 try{
  const administrator=createAuthAdministrator();
  if(await emailIsNew(email,page=>administrator.listUsers({page,perPage:100}))!=="new")return{ok:false,message:"An existing sign-in or incomplete directory check prevents retry preparation."};
  const active=await requireAdminMutation();
  const {error}=await active.supabase.rpc("admin_mark_player_invite_rejected",{p_attempt:attemptId,p_athlete:athleteId,p_email:email});
  if(error)return{ok:false,message:error.message?.includes("another administrator")?"Only the administrator who started this invitation can return it to the list.":"Invitation details changed or this account is already connected."};
  return{ok:true,message:"Returned to the remaining invitation list. No email sent. Refresh after the email limit resets."};
 }catch{return{ok:false,message:"Could not verify the invitation. Nothing was resent."};}
}
