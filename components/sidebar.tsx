"use client";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { UsersRound, Upload, ShieldCheck, UserRound, Settings, BarChart3, ListOrdered, ClipboardList, ChartScatter } from "lucide-react";
import type { Role } from "@/lib/types";
import { PacificBrand } from "@/components/pacific-brand";
export function Sidebar({ roles, athleteId, isPreview = false }: { roles: Role[]; athleteId: string | null; isPreview?: boolean }) {
  const staff = roles.some(r => r === "admin" || r === "coach");
  const links = [
    ...(staff ? [{ href: "/roster", label: "Team Roster", icon: UsersRound, group: "Team" }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound, group: "Team" }] : []),
    { href: "/game-stats", label: "Game Stats", icon: BarChart3, group: "Team" },
    { href: "/leaderboards", label: "Leaderboards", icon: ListOrdered, group: "Team" },
    ...(staff && (!isPreview || roles.includes("coach")) ? [{ href: "/analytics", label: "Analytics", icon: ChartScatter, group: "Staff Tools" }, { href: "/testing", label: "Testing", icon: ClipboardList, group: "Staff Tools" }, { href: "/imports", label: "Information Imports", icon: Upload, group: "Staff Tools" }] : []),
    ...(roles.includes("admin") && !isPreview ? [{ href: "/admin/rollout", label: "Team Rollout", icon: UsersRound, group: "Administration" }, { href: "/admin/access", label: "Account Access", icon: ShieldCheck, group: "Administration" }] : []),
    { href: "/settings", label: "Settings", icon: Settings, group: "Preferences" }];
  return <aside className="sidebar baseball-sidebar"><Link href="/" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home" title="Back to home"><PacificBrand compact /></Link><div className="sidebar-rule" /><WorkspaceNavigation links={links} /><div className="sidebar-bottom mt-auto px-4"><p className="sidebar-motto">People Lie.<br /><span>Numbers Don’t.</span></p><p className="sidebar-disclosure">An independent project.<br />Not an official university application.</p></div></aside>;
}
