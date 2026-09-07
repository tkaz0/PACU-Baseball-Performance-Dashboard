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
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div role="tablist" aria-label="Player performance" className="flex w-full min-w-0 gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-panel)] p-1 sm:w-auto">
        {tabs.map((tab, index) => <button key={tab.id} ref={button => { buttons.current[index] = button; }} type="button" role="tab" id={`${prefix}-tab-${tab.id}`} aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelectedId(tab.id)} onKeyDown={event => keyDown(event, index)} className={`min-h-11 min-w-0 flex-1 rounded-md px-2.5 py-2.5 text-xs font-bold outline-offset-4 transition-colors sm:flex-none sm:px-5 sm:text-sm ${selected === index ? "bg-pacu-red text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"}`}>{tab.label}</button>)}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
    {tabs.map((tab, index) => <div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`} aria-labelledby={`${prefix}-tab-${tab.id}`} hidden={selected !== index} tabIndex={0} className="min-w-0 space-y-7 outline-offset-4 sm:space-y-8">{tab.content}</div>)}
  </div>;
}
