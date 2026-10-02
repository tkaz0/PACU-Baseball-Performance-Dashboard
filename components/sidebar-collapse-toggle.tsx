"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SIDEBAR_STORAGE_KEY } from "@/lib/sidebar-preference";

/** Desktop-only: shrink the sidebar to icons. The choice is remembered in this browser; CSS shows the matching label. */
export function SidebarCollapseToggle() {
  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement, next = root.dataset.sidebar !== "collapsed";
    if (next) root.dataset.sidebar = "collapsed"; else delete root.dataset.sidebar;
    event.currentTarget.setAttribute("aria-pressed", String(next));
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded"); } catch { /* Private mode: still applies for this page. */ }
  }
  return <button type="button" className="sidebar-collapse-toggle" onClick={toggle} aria-label="Collapse or expand sidebar" title="Collapse or expand sidebar" suppressHydrationWarning>
    <PanelLeftClose className="when-expanded" size={17} aria-hidden="true"/><PanelLeftOpen className="when-collapsed" size={17} aria-hidden="true"/><span>Collapse</span>
  </button>;
}
