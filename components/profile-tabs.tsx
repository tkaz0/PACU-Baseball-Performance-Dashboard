"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
export type ProfileTab = { id: string; label: string; content: ReactNode };
export function ProfileTabs({ tabs, action }: { tabs: ProfileTab[]; action?: ReactNode }) {
  const prefix = useId(), [selectedId, setSelectedId] = useState(tabs[0]?.id), buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = Math.max(0, tabs.findIndex(tab => tab.id === selectedId));
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setSelectedId(tabs[next].id); buttons.current[next]?.focus();
  }
  return <div className="min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line-subtle)]">
      <div role="tablist" aria-label="Player performance" className="flex min-w-0 flex-wrap gap-x-1 gap-y-1 sm:gap-x-4">
        {tabs.map((tab, index) => <button key={tab.id} ref={button => { buttons.current[index] = button; }} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelectedId(tab.id)} onKeyDown={event => keyDown(event, index)} className={`min-h-12 border-b-[3px] px-2 py-3 text-sm font-bold outline-offset-4 sm:px-4 ${selected === index ? "border-[var(--accent-readable)] text-[var(--accent-readable)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{tab.label}</button>)}
      </div>
      {action && <div className="pb-3">{action}</div>}
    </div>
    {tabs.map((tab, index) => <div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`} hidden={selected !== index} tabIndex={0} className="min-w-0 space-y-6 outline-offset-4">{tab.content}</div>)}
  </div>;
}
