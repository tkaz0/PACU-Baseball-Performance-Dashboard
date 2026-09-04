"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UsersRound, Upload } from "lucide-react";

const links = [
  { href: "/preview", label: "Overview", icon: LayoutDashboard },
  { href: "/preview/roster", label: "Master roster", icon: UsersRound },
  { href: "/preview/import", label: "Import Center", icon: Upload },
];

export function PreviewSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/preview" className="px-4 text-white no-underline">
        <span className="text-3xl font-black tracking-tight">PACU<span className="text-pacu-red">.</span></span>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-[.16em] text-gray-400">Baseball Performance</span>
      </Link>
      <div className="my-7 hidden border-t border-white/10 min-[901px]:block" />
      <p className="eyebrow hidden px-4 text-gray-500 min-[901px]:block">Workspace</p>
      <nav aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const current = pathname === href || (href === "/preview/roster" && pathname.startsWith("/preview/athletes/"));
          return (
            <Link className="nav-link" href={href} key={href} aria-current={current ? "page" : undefined}>
              <Icon size={18} /><span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom mt-auto px-4">
        <div className="mb-4 border-t border-white/10 pt-6 text-sm font-semibold text-gray-200">No sign-in needed</div>
        <p className="mb-1 text-xs text-gray-400">Imports stay in this browser</p>
        <p className="mt-6 text-xs leading-relaxed text-gray-500">Independently owned by<br />Trevor Kazahaya</p>
      </div>
    </aside>
  );
}
