"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";

export type WorkspaceNavLink = { href: string; label: string; icon: LucideIcon; current?: boolean };

export function WorkspaceNavigation({ links }: { links: WorkspaceNavLink[] }) {
  const path = usePathname(), id = useId(), toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = links.filter(link => link.current ?? (path === link.href || path.startsWith(`${link.href}/`))).sort((a, b) => b.href.length - a.href.length)[0];
  return <div className="workspace-navigation" onKeyDown={event => {
    if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <button ref={toggle} type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="flex min-w-0 items-center gap-2">{open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}Menu</span><span className="truncate text-xs font-normal text-gray-300">{current?.label ?? "Workspace"}</span>
    </button>
    <nav id={id} className="workspace-nav" data-open={open} aria-label="Main navigation">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} className="nav-link" href={href} aria-current={current?.href === href ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
