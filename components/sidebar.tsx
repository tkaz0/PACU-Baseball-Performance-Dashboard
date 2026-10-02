"use client";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import Link from "next/link";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { LayoutGrid, House, UsersRound, Upload, ShieldCheck, UserRound, Settings, BarChart3, ListOrdered, ClipboardList, ChartScatter, TrendingUp, ArrowLeftRight, BellDot, FileChartColumn, DraftingCompass, Target, Image } from "lucide-react";
import type { Role } from "@/lib/types";
import { PacificBrand, PacificLogo } from "@/components/pacific-brand";
import type { DesignNavigation } from "@/lib/design-navigation";
export function Sidebar({ roles, athleteId, isPreview = false, designNavigation }: { roles: Role[]; athleteId: string | null; isPreview?: boolean; designNavigation?: DesignNavigation }) {
  const staff = roles.some(r => r === "admin" || r === "coach");
  const linkedPlayer = roles.includes("player") && !!athleteId;
  const links = [
    { href: "/overview", label: "Home", icon: House, group: "Team" },
    ...(staff ? [{ href: "/roster", label: "Team Roster", icon: UsersRound, group: "Team" }] : []),
    ...(athleteId ? [{ href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound, group: "Team" }] : []),
    ...(staff || (linkedPlayer && designNavigation?.swing) ? [{ href: "/swing-design", label: "Swing Design", icon: DraftingCompass, group: "Team" }] : []),
    ...(staff || (linkedPlayer && designNavigation?.pitch) ? [{ href: "/pitch-design", label: "Pitch Design", icon: Target, group: "Team" }] : []),
    { href: "/game-stats", label: "Game Stats", icon: BarChart3, group: "Team" },
    { href: "/leaderboards", label: "Leaderboards", icon: ListOrdered, group: "Team" },
    ...(staff || (roles.includes("player") && athleteId) ? [{ href: "/graphics", label: "Graphics", icon: Image, group: "Team" }] : []),
    ...(staff && (!isPreview || roles.includes("coach")) ? [{ href: "/team-progress", label: "Team Progress", icon: TrendingUp, group: "Coaching" }, { href: "/top-performers", label: "Top Performers", icon: LayoutGrid, group: "Coaching" }, { href: "/compare", label: "Compare Players", icon: ArrowLeftRight, group: "Coaching" }, { href: "/analytics", label: "Analytics", icon: ChartScatter, group: "Coaching" }, { href: "/exit-meetings", label: "Exit Meetings", icon: FileChartColumn, group: "Coaching" }, { href: "/imports", label: "Import Center", icon: Upload, group: "Coaching" }, { href: "/testing/changes", label: "What Changed", icon: BellDot, group: "Data & Testing" }, { href: "/game-stats/review", label: "Data Review", icon: ShieldCheck, group: "Data & Testing" }, { href: "/testing/coverage", label: "Testing", icon: ClipboardList, group: "Data & Testing" }] : []),
    ...(roles.includes("admin") && !isPreview ? [{ href: "/admin/rollout", label: "Team Rollout", icon: UsersRound, group: "Administration" }, { href: "/admin/access", label: "Account Access", icon: ShieldCheck, group: "Administration" }] : []),
    { href: "/settings", label: "Settings", icon: Settings, group: "" }];
  return <aside className="sidebar baseball-sidebar"><Link prefetch={false} href="/" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home" title="Back to home"><PacificBrand compact /></Link><div className="sidebar-rule" /><WorkspaceNavigation links={links} /><SidebarCollapseToggle /><div className="sidebar-bottom mt-auto px-4"><div className="sidebar-boxer"><PacificLogo variant="university" tone="dark" /><p>Boxer Baseball</p></div><p className="sidebar-disclosure">An independent project.<br />Not an official university application.</p></div></aside>;
}
