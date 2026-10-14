"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, House, ImageIcon, ListOrdered, UserRound, UsersRound, ChartScatter } from "lucide-react";
import type { Role } from "@/lib/types";

/** Phone-only bottom bar with the most-used pages for the presented role; the full menu stays in the header. */
export function MobileTabBar({ roles, athleteId }: { roles: Role[]; athleteId: string | null }) {
  const path = usePathname();
  const staff = roles.some(r => r === "admin" || r === "coach");
  const linkedPlayer = roles.includes("player") && !!athleteId;
  const links = staff ? [
    { href: "/overview", label: "Home", icon: House }, { href: "/roster", label: "Roster", icon: UsersRound }, { href: "/leaderboards", label: "Leaders", icon: ListOrdered },
    { href: "/game-stats", label: "Games", icon: BarChart3 }, { href: "/analytics", label: "Analytics", icon: ChartScatter },
  ] : linkedPlayer ? [
    { href: "/overview", label: "Home", icon: House }, { href: `/athletes/${athleteId}`, label: "My Profile", icon: UserRound }, { href: "/leaderboards", label: "Leaders", icon: ListOrdered },
    { href: "/game-stats", label: "Games", icon: BarChart3 }, { href: "/graphics", label: "Graphics", icon: ImageIcon },
  ] : [];
  if (links.length < 3) return null;
  const current = (href: string) => path === href || path.startsWith(`${href}/`) || (href === "/leaderboards" && path.startsWith("/records")) || (href === "/roster" && staff && path.startsWith("/athletes/"));
  return <nav className="mobile-tab-bar" aria-label="Quick navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={false} aria-current={current(href) ? "page" : undefined}><Icon size={20} aria-hidden="true"/><span>{label}</span></Link>)}</nav>;
}
