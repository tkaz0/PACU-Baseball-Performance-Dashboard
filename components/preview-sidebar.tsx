"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload, HardDrive, ShieldCheck, UserRound } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";
import { PacificBrand } from "@/components/pacific-brand";

const links = [
  { href: "/preview", label: "Overview", icon: LayoutDashboard },
  { href: "/preview/roster", label: "Master Roster", icon: UsersRound },
  { href: "/preview/import", label: "Import Center", icon: Upload },
  { href: "/preview/access", label: "Access & Views", icon: ShieldCheck },
];

export function PreviewSidebar() {
  const pathname = usePathname();
  const { view } = useLocalWorkspace();
  const visibleLinks = view.role === "admin" ? links : view.role === "coach" ? links.slice(0, 2) : [
    { href: "/preview", label: "My Overview", icon: LayoutDashboard },
    ...(view.athleteCode ? [{ href: `/preview/athletes/${view.athleteCode}`, label: "My Profile", icon: UserRound }] : []),
  ];

  return (
    <aside className="sidebar baseball-sidebar">
      <Link href="/preview" className="sidebar-brand-link" aria-label="Pacific Baseball Performance home"><PacificBrand compact /></Link>
      <div className="sidebar-rule" />
      <p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">The clubhouse</p>
      <nav aria-label="Main navigation">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const current = pathname === href || (href === "/preview/roster" && pathname.startsWith("/preview/athletes/"));
          return (
            <Link className="nav-link" href={href} key={href} aria-current={current ? "page" : undefined}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom mt-auto px-4">
        <div className="sidebar-storage"><HardDrive size={18} aria-hidden="true" /><div><strong>Admin Import Workspace</strong><span>Imports stay in this browser</span></div></div>
        <p className="mt-6 text-xs leading-relaxed text-gray-400">An independent project.<br />Not an official university application.</p>
      </div>
    </aside>
  );
}
