"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Eye, ShieldCheck, UsersRound, UserRound } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { adminView, localViewAllowsPath, type LocalView } from "@/lib/local-view";
import { PageHeading } from "@/components/page-heading";

export function LocalViewControl() {
  const { view, setView, viewChoices, ready } = useLocalWorkspace();
  const [athleteCode, setAthleteCode] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  function change(next: LocalView) {
    setView(next);
    if (menu.current) menu.current.open = false;
    router.push(next.role === "player" && next.athleteCode ? `/preview/athletes/${next.athleteCode}` : "/preview");
  }
  return <details className="view-menu" ref={menu} onKeyDown={event => { if (event.key === "Escape" && menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
    <summary className="btn btn-secondary"><Eye size={16} aria-hidden="true" />{view.role === "admin" ? "View as" : `As: ${view.role === "coach" ? "Coach" : "Player"}`}</summary>
    <div className="view-menu-panel">
      <p className="eyebrow text-pacu-red">Preview workspace views</p>
      <p className="view-menu-note">See each role’s layout using this browser’s data. Account permissions require sign-in.</p>
      <button className="view-menu-option" disabled={!ready} onClick={() => change(adminView())}><ShieldCheck size={18} /><span><strong>Admin{view.role === "admin" ? " · Current" : ""}</strong><small>Roster, imports, and workspace controls</small></span></button>
      <button className="view-menu-option" disabled={!ready} onClick={() => change({ role: "coach", athleteCode: null })}><UsersRound size={18} /><span><strong>Coach{view.role === "coach" ? " · Current" : ""}</strong><small>Team overview and all athlete profiles</small></span></button>
      <div className="view-player-choice"><label htmlFor="local-preview-player">Player to preview</label><select id="local-preview-player" value={athleteCode} onChange={event => setAthleteCode(event.target.value)} disabled={!ready}><option value="">Choose a player</option>{viewChoices.map(a => <option key={a.code} value={a.code}>{a.name} · {a.code}</option>)}</select><button className="btn btn-primary w-full" disabled={!ready || !viewChoices.some(a => a.code === athleteCode)} onClick={() => change({ role: "player", athleteCode })}><UserRound size={16} />Preview player</button></div>
    </div>
  </details>;
}

export function LocalViewBanner() {
  const { view, setView } = useLocalWorkspace();
  const router = useRouter();
  if (view.role === "admin") return null;
  return <div className="access-preview-banner" role="status"><div><Eye size={19} aria-hidden="true" /><span><strong>Viewing as: {view.role === "coach" ? "Coach" : "Player"}</strong><small>Read-only layout preview · Sign-in is still paused</small></span></div><button className="btn btn-secondary" onClick={() => { setView(adminView()); router.push("/preview"); }}>Exit preview</button></div>;
}

export function LocalViewBoundary({ children }: { children: React.ReactNode }) {
  const { view, ready } = useLocalWorkspace();
  const pathname = usePathname();
  if (!ready) return <p role="status">Opening your workspace…</p>;
  if (!localViewAllowsPath(view, pathname)) return <section className="panel empty-state"><ShieldCheck size={30} aria-hidden="true" /><h1 className="page-title">Not part of this view</h1><p>{view.role === "player" ? "Players see their own profile and performance records." : "Imports and account controls are managed by an administrator."} Exit preview to return to the full workspace.</p><Link className="btn btn-primary" href={view.role === "player" && view.athleteCode ? `/preview/athletes/${view.athleteCode}` : "/preview"}>{view.role === "player" ? "My profile" : "Team overview"}</Link></section>;
  return <>{children}</>;
}

export function LocalAccessPage() {
  const { setView } = useLocalWorkspace();
  const router = useRouter();
  const roles = [
    { title: "Admin", icon: ShieldCheck, description: "Run the workspace.", items: ["View every athlete profile", "Review and import team data", "Manage account roles and athlete links after sign-in", "Preview coach and player views"] },
    { title: "Coach", icon: UsersRound, description: "Follow the whole team.", items: ["View the team overview and roster", "Open every athlete’s profile", "Review available performance charts", "No imports or account administration"] },
    { title: "Player", icon: UserRound, description: "Focus on personal progress.", items: ["Open their own linked profile", "Review their own measurements and charts", "See their roster and season details", "No other athletes or admin controls"] },
  ];
  return <>
    <PageHeading section="Pacific Baseball / Administration" title="Access & views" description="A clear workspace for every role. Preview the experience, then manage team accounts in the private workspace." />
    <section className="access-intro panel"><div><span className="badge">Browser workspace</span><h2>Your workspace controls</h2><p>Roster imports, measurements, and backups are available here while sign-in is paused. The View as menu lets you explore coach and player layouts without changing saved data.</p></div><Link className="btn btn-secondary" href="/preview/import">Open Import Center <ArrowRight size={16} /></Link></section>
    <div className="access-role-grid">{roles.map(({ title, icon: Icon, description, items }) => <section className="panel access-role-card" key={title}><span className="access-role-icon"><Icon size={23} /></span><h2>{title}</h2><p>{description}</p><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</div>
    <section className="panel access-next"><div><p className="eyebrow text-pacu-red">Account access</p><h2>Ready for separate team logins</h2><p>Sign in as an approved administrator to enable or disable existing accounts, assign roles, and link a player to the correct athlete. These previews do not create accounts or protect data saved in this browser.</p></div><div className="flex flex-wrap gap-3"><Link className="btn btn-primary" href="/login">Sign in to manage accounts <ArrowRight size={16} /></Link><button className="btn btn-secondary" onClick={() => { setView({ role: "coach", athleteCode: null }); router.push("/preview"); }}>Preview coach view</button></div></section>
  </>;
}
