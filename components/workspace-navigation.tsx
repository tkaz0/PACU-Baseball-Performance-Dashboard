"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ChevronDown, Menu, X, type LucideIcon } from "lucide-react";

export type WorkspaceNavLink = { href: string; label: string; icon: LucideIcon; current?: boolean; group?: string };

export function WorkspaceNavigation({ links }: { links: WorkspaceNavLink[] }) {
  const path = usePathname(), id = useId(), toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = links.filter(link => link.current ?? (path === link.href || path.startsWith(`${link.href}/`) || (link.href === "/testing/coverage" && path.startsWith("/testing")) || (link.href === "/roster" && path.startsWith("/athletes/")))).sort((a, b) => b.href.length - a.href.length)[0];
  const groups = links.reduce<{ name: string; items: WorkspaceNavLink[] }[]>((result, link) => {
    const name = link.group ?? "";
    if (result.at(-1)?.name === name) result.at(-1)!.items.push(link);
    else result.push({ name, items: [link] });
    return result;
  }, []);
  const renderLink = ({ href, label, icon: Icon }: WorkspaceNavLink) => <div className="workspace-nav-item" key={href}><Link prefetch={false} className="nav-link" href={href} aria-current={current?.href === href ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link></div>;
  return <div className="workspace-navigation" onKeyDown={event => {
    if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <button ref={toggle} type="button" className="workspace-menu-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="flex min-w-0 items-center gap-2">{open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}Menu</span><span className="truncate text-xs font-normal text-gray-300">{current?.label ?? "Workspace"}</span>
    </button>
    <nav id={id} className="workspace-nav" data-open={open} aria-label="Main navigation">
      {groups.map(group => ["More Staff Tools", "Administration"].includes(group.name) ? <details className="workspace-nav-disclosure" key={`${group.name}:${path}`} open={group.items.some(item => item.href === current?.href)}><summary>{group.name}<ChevronDown size={15} aria-hidden="true"/></summary><div className="workspace-nav-disclosure-links">{group.items.map(renderLink)}</div></details> : <div className="workspace-nav-section" key={group.name}>{group.name && <p className="workspace-nav-group">{group.name}</p>}{group.items.map(renderLink)}</div>)}
    </nav>
  </div>;
}
