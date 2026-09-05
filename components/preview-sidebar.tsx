"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload, HardDrive, ShieldCheck, UserRound } from "lucide-react";
import { useLocalWorkspace } from "@/components/local-workspace";

const links = [
  { href: "/preview", label: "Overview", icon: LayoutDashboard },
  { href: "/preview/roster", label: "Master roster", icon: UsersRound },
  { href: "/preview/import", label: "Import Center", icon: Upload },
  { href: "/preview/access", label: "Access & views", icon: ShieldCheck },
];

export function PreviewSidebar() {
  const pathname = usePathname();
  const { view } = useLocalWorkspace();
  const visibleLinks = view.role === "admin" ? links : view.role === "coach" ? links.slice(0, 2) : [
    { href: "/preview", label: "My overview", icon: LayoutDashboard },
    ...(view.athleteCode ? [{ href: `/preview/athletes/${view.athleteCode}`, label: "My profile", icon: UserRound }] : []),
  ];

  return (
    <aside className="sidebar baseball-sidebar">
      <Link href="/preview" className="baseball-brand" aria-label="Pacific Baseball Performance home">
        <svg className="brand-diamond" viewBox="0 0 64 64" aria-hidden="true"><path d="m32 4 28 28-28 28L4 32Z" fill="currentColor" /><path d="M23 17h11c10 0 14 5 14 12s-4 12-14 12h-3v9h-8Zm8 8v8h3c4 0 6-1 6-4s-2-4-6-4Z" fill="white" /></svg>
        <span><span className="brand-pacific">Pacific</span><span className="brand-baseball">Baseball</span><span className="brand-performance">Performance</span></span>
      </Link>
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
        <div className="sidebar-storage"><HardDrive size={18} aria-hidden="true" /><div><strong>No sign-in needed</strong><span>Imports stay in this browser</span></div></div>
        <p className="mt-6 text-xs leading-relaxed text-gray-400">A personal project by<br /><span className="text-gray-200">Trevor Kazahaya</span></p>
      </div>
    </aside>
  );
}
