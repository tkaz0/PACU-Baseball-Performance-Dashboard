"use client";
import { useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { Activity, ChartNoAxesCombined, Dumbbell, History, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { profileTabHref } from "@/lib/profile-tab";
import styles from "./profile-tabs.module.css";
export type ProfileTab = { id: string; label: string; content: ReactNode };
type ProfileTabsProps = { tabs: ProfileTab[]; action?: ReactNode; selectedTab?: string; navigationPath?: string };
export function ProfileTabs(props: ProfileTabsProps) {
  return props.navigationPath && props.selectedTab !== undefined ? <RoutedProfileTabs {...props}/> : <ProfileTabView {...props}/>;
}
function RoutedProfileTabs(props: ProfileTabsProps) {
  const router = useRouter(), [pending, startTransition] = useTransition();
  return <ProfileTabView {...props} pending={pending} navigate={id => {
    if (id !== props.selectedTab) startTransition(() => router.push(profileTabHref(props.navigationPath!, id), { scroll: false }));
  }}/>;
}
function ProfileTabView({ tabs, action, selectedTab, navigationPath, pending=false, navigate }: ProfileTabsProps & { pending?: boolean; navigate?: (id: string) => void }) {
  const prefix = useId(), [selectedId, setSelectedId] = useState(tabs[0]?.id), buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = Math.max(0, tabs.findIndex(tab => tab.id === (selectedTab ?? selectedId)));
  function select(id: string) {
    if (navigate) navigate(id); else setSelectedId(id);
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); select(tabs[next].id); buttons.current[next]?.focus();
  }
  const icons = { overview: ChartNoAxesCombined, physicality: Activity, "in-game": Target, practice: Dumbbell, progress: History };
  return <div className="min-w-0">
    <div className={styles.toolbar}>
      <div role="tablist" aria-label="Player performance" className={`profile-tab-navigation ${styles.navigation}`}>
        {tabs.map((tab, index) => { const Icon = icons[tab.id as keyof typeof icons]; return <button key={tab.id} ref={button => { buttons.current[index] = button; }} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => select(tab.id)} onKeyDown={event => keyDown(event, index)} className={`min-h-11 min-w-fit flex-auto whitespace-nowrap rounded-md px-2.5 py-2.5 text-xs font-bold outline-offset-4 transition-colors sm:flex-none sm:px-5 sm:text-sm ${selected === index ? "bg-pacu-red text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"}`}>{Icon && <Icon size={17} aria-hidden="true"/>}{tab.label}</button>; })}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
    {pending && <p role="status" className="muted text-sm">Loading selected stats…</p>}
    {tabs.map((tab, index) => <div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`} hidden={selected !== index} tabIndex={0} className="min-w-0 space-y-5 outline-offset-4 sm:space-y-6">{navigationPath && selectedTab !== undefined && selected !== index ? null : tab.content}</div>)}
  </div>;
}
