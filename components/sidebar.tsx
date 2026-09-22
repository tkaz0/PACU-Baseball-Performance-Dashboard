"use client";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { House, UsersRound, Upload, ShieldCheck, UserRound, Settings, BarChart3, ListOrdered, ClipboardList, ChartScatter, TrendingUp, ArrowLeftRight, BellDot } from "lucide-react";
import type { Role } from "@/lib/types";
import { PacificBrand, PacificLogo } from "@/components/pacific-brand";
export function Sidebar({ roles, athleteId, isPreview = false }: { roles: Role[]; athleteId: string | null; isPreview?: boolean }) {
  const staff = roles.some(r => r === "admin" || r === "coach");
  const links = [
    { href: "/overview", label: "Home", icon: House, group: "Team" },
    ...(staff ? [{ href: "/roster", label: "Team Roster", icon: UsersRound, group: "Team" }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound, group: "Team" }] : []),
    { href: "/game-stats", label: "Game Stats", icon: BarChart3, group: "Team" },
    { href: "/leaderboards", label: "Leaderboards", icon: ListOrdered, group: "Team" },
    ...(staff && (!isPreview || roles.includes("coach")) ? [{ href: "/team-progress", label: "Team Progress", icon: TrendingUp, group: "Staff Tools" }, { href: "/compare", label: "Compare Players", icon: ArrowLeftRight, group: "Staff Tools" }, { href: "/analytics", label: "Analytics", icon: ChartScatter, group: "Staff Tools" }, { href: "/imports", label: "Import Center", icon: Upload, group: "Staff Tools" }, { href: "/testing/changes", label: "What Changed", icon: BellDot, group: "More Staff Tools" }, { href: "/game-stats/review", label: "Data Review", icon: ShieldCheck, group: "More Staff Tools" }, { href: "/testing/coverage", label: "Testing", icon: ClipboardList, group: "More Staff Tools" }] : []),
    ...(roles.includes("admin") && !isPreview ? [{ href: "/admin/rollout", label: "Team Rollout", icon: UsersRound, group: "Administration" }, { href: "/admin/access", label: "Account Access", icon: ShieldCheck, group: "Administration" }] : []),
    { href: "/settings", label: "Settings", icon: Settings, group: "Preferences" }];
  return <aside className="sidebar baseball-sidebar"><Link prefetch={false} href="/" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home" title="Back to home"><PacificBrand compact /></Link><div className="sidebar-rule" /><WorkspaceNavigation links={links} /><div className="sidebar-bottom mt-auto px-4"><div className="sidebar-boxer"><PacificLogo variant="university" tone="dark" /><p>Boxer Baseball</p></div><p className="sidebar-disclosure">An independent project.<br />Not an official university application.</p></div></aside>;
}
