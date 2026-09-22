"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {Check,Clock3,RefreshCw} from "lucide-react";
import {accountSetupStage,type AccountSetupStatus} from "@/lib/account-setup-status";

const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value)):"—";
export function AccountSetupTable({accounts}:{accounts:AccountSetupStatus[]}){
 const [query,setQuery]=useState(""),[stage,setStage]=useState("all"),[role,setRole]=useState("all");
 const [refreshing,startTransition]=useTransition(),router=useRouter();
 const visible=accounts.filter(a=>(role==="all"||a.roles.some(r=>r===role))&&(stage==="all"||(stage==="disabled"?!a.active:accountSetupStage(a)===stage))&&`${a.name} ${a.email??""} ${a.code??""}`.toLowerCase().includes(query.trim().toLowerCase()));
 const invited=accounts.filter(a=>a.invitedAt);
 return <div className="space-y-5">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Invitation totals">
   {[{label:"Invitations Accepted",value:invited.filter(a=>a.acceptedAt).length,detail:`of ${invited.length} invited accounts`},{label:"Passwords Set",value:accounts.filter(a=>a.passwordSet).length,detail:`of ${accounts.length} configured accounts`},{label:"Waiting for Acceptance",value:invited.filter(a=>!a.acceptedAt).length,detail:"invitation not yet accepted"}].map(item=><div className="panel p-5" key={item.label}><p className="muted m-0 text-sm">{item.label}</p><p className="mb-1 mt-2 text-3xl font-bold tabular-nums">{item.value}</p><p className="muted m-0 text-xs">{item.detail}</p></div>)}
  </div>
  <section className="panel min-w-0 p-4 sm:p-6" aria-labelledby="setup-accounts-heading">
   <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="setup-accounts-heading" className="m-0 text-lg font-bold">Players & Staff</h2><button type="button" className="btn btn-secondary" disabled={refreshing} onClick={()=>startTransition(()=>router.refresh())}><RefreshCw size={15} aria-hidden="true"/>{refreshing?"Refreshing…":"Refresh Status"}</button></div>
   <div className="mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]"><label className="text-sm">Search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, email or PAC code"/></label><label className="text-sm">Setup Status<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All Accounts</option><option value="waiting">Waiting for Acceptance</option><option value="password">Accepted · Password Needed</option><option value="complete">Setup Complete</option><option value="disabled">Access Disabled</option></select></label><label className="text-sm">Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="all">Players & Staff</option><option value="player">Players</option><option value="coach">Coaches</option><option value="admin">Admins</option></select></label></div>
   <p className="muted text-xs" role="status">{visible.length} of {accounts.length} accounts · Times shown in Pacific time</p>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col">Person</th><th scope="col">Invitation</th><th scope="col">Password</th><th scope="col">Last Sign-In</th><th scope="col">Access</th></tr></thead><tbody>{visible.map(a=><tr key={a.userId}>
    <td className="min-w-52"><div className="font-semibold">{a.athleteId?<Link href={`/athletes/${a.athleteId}`} className="text-link">{a.name}</Link>:a.name}</div><div className="muted mt-1 max-w-64 break-all text-xs">{a.email??"No email"}</div><div className="muted mt-1 text-xs">{a.roles.map(r=>r.charAt(0).toUpperCase()+r.slice(1)).join(" + ")}{a.code?` · ${a.code}`:""}</div></td>
    <td className="min-w-40"><span className={`inline-flex items-center gap-1.5 font-semibold ${a.acceptedAt?"text-emerald-600 dark:text-emerald-400":"muted"}`}>{a.acceptedAt?<Check size={15} aria-hidden="true"/>:<Clock3 size={15} aria-hidden="true"/>}{a.acceptedAt?(a.invitedAt?"Accepted":"Email Verified"):(a.invitedAt?"Pending":"Not Invited")}</span><span className="muted mt-1 block text-xs">{a.acceptedAt?formatDate(a.acceptedAt):a.invitedAt?`Sent ${formatDate(a.invitedAt)}`:"No invitation recorded"}</span></td>
    <td className="min-w-28"><span className={`badge ${a.passwordSet?"badge-green":"badge-neutral"}`}>{a.passwordSet?"Set":"Not Set"}</span></td>
    <td className="min-w-36 text-xs">{a.lastSignInAt?formatDate(a.lastSignInAt):"Not Yet"}</td>
    <td><span className={`badge ${a.active?"badge-green":"badge-red"}`}>{a.active?"Active":"Disabled"}</span></td>
   </tr>)}</tbody></table></div>
   {!visible.length&&<p className="notice mt-4">No accounts match these filters.</p>}
   <p className="muted mb-0 mt-5 text-xs">Accepted confirms email verification. Password Set confirms a password exists, without showing it. A last sign-in can include opening a setup link. Disabled accounts remain blocked even after setup is complete.</p>
  </section>
 </div>;
}
