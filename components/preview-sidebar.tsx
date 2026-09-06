"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload, HardDrive, ShieldCheck, UserRound } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { WorkspaceNavigation } from "@/components/workspace-navigation";
import { PacificBrand } from "@/components/pacific-brand";

const links = [
  { href: "/preview", label: "Team", icon: LayoutDashboard },
  { href: "/preview/roster", label: "Master Roster", icon: UsersRound },
  { href: "/preview/import", label: "Import Center", icon: Upload },
  { href: "/preview/access", label: "Access & Views", icon: ShieldCheck },
];

export function PreviewSidebar() {
  const pathname = usePathname();
  const { view, canImport, canManage } = useLocalWorkspace();
  const visibleLinks = canManage ? links : view.role === "coach" ? links.slice(0, canImport ? 3 : 2) : [
    ...(!view.athleteCode ? [{ href: "/preview", label: "My Profile", icon: UserRound }] : []),
    ...(view.athleteCode ? [{ href: `/preview/athletes/${view.athleteCode}`, label: "My Profile", icon: UserRound }] : []),
  ];

  return (
    <aside className="sidebar baseball-sidebar">
      <Link href="/preview" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home"><PacificBrand compact /></Link>
      <div className="sidebar-rule" />
      <p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">The clubhouse</p>
      <WorkspaceNavigation links={visibleLinks.map(link => ({ ...link, current: pathname === link.href || (link.href === "/preview/roster" && pathname.startsWith("/preview/athletes/")) }))} />
      <div className="sidebar-bottom mt-auto px-4">
        <div className="sidebar-storage"><HardDrive size={18} aria-hidden="true" /><div><strong>Staff Import Workspace</strong><span>Imports stay in this browser</span></div></div>
        <p className="mt-6 text-xs leading-relaxed text-gray-400">An independent project.<br />Not an official university application.</p>
      </div>
    </aside>
  );
}
