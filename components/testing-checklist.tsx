"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, ClipboardList, Plus } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { TESTING_CATEGORIES, testingMetrics, type TestingChecklist as Checklist } from "@/lib/testing-checklist";

function testDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function TestingChecklist({ checklist }: { checklist: Checklist }) {
  const router = useRouter();
  const { metric, recordedCount, needsTestingCount, totalCount } = checklist;
  const category = TESTING_CATEGORIES.find(item => item.metricKeys.includes(metric.key))!;
  const entry = `/testing/entry?metric=${encodeURIComponent(metric.key)}`;
  const rows = [...checklist.rows].sort((a, b) => Number(a.status === "recorded") - Number(b.status === "recorded"));
  return <div data-testid="testing-checklist">
    <PageHeading section="Pacific Baseball / Staff" title="Fall Testing" description="See who still needs a test. Record results as your team completes them.">
      <Link href={entry} className="btn btn-primary"><Plus size={16} aria-hidden="true" />Enter Results</Link>
    </PageHeading>

    <nav className="testing-categories" aria-label="Testing categories">
      {TESTING_CATEGORIES.map(item => <Link key={item.key} href={`/testing?metric=${item.metricKeys[0]}`} aria-current={category.key === item.key ? "page" : undefined}>{item.label}</Link>)}
    </nav>

    <section className="panel testing-progress" aria-labelledby="testing-progress-heading">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0"><label htmlFor="testing-metric" className="eyebrow mb-2 block text-pacu-red">Select Test</label>
          <select id="testing-metric" className="testing-metric-select" value={metric.key} onChange={event => router.push(`/testing?metric=${encodeURIComponent(event.target.value)}`)}>
            {testingMetrics(category.key).map(item => <option key={item.key} value={item.key}>{item.key === "bat_speed" ? "Bat Speed (Unspecified)" : item.label}</option>)}
          </select>
        </div>
        <p className="m-0 text-xs text-[var(--text-secondary)]">Sep 1–Dec 31, 2026</p>
      </div>
      <h2 id="testing-progress-heading" className="sr-only">{metric.label} testing progress</h2>
      <dl className="testing-counts">
        <div><dt>Needs Testing</dt><dd>{needsTestingCount}</dd></div>
        <div><dt>Recorded This Fall</dt><dd>{recordedCount}</dd></div>
        <div><dt>Eligible Players</dt><dd>{totalCount}</dd></div>
      </dl>
      <progress className="testing-progress-bar" aria-label={`${metric.label}: ${recordedCount} of ${totalCount} players recorded this fall`} value={recordedCount} max={Math.max(1, totalCount)} />
      <p className="mb-0 mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">Updated from saved results through {testDate(checklist.today)}. Earlier tests remain on player profiles.</p>
    </section>

    <section className="mt-7" aria-labelledby="testing-roster-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 id="testing-roster-heading" className="m-0 text-lg font-bold">{metric.label} Checklist</h2><span className="text-xs text-[var(--text-secondary)]">Players needing a test appear first</span></div>
      {rows.length ? <ul className="panel m-0 list-none divide-y divide-[var(--line-subtle)] p-0" aria-label={`${metric.label} testing checklist`}>
        {rows.map(({ athlete, latest, status }) => <li key={athlete.id} className="testing-player-row">
          <span className={`testing-status-icon ${status === "recorded" ? "is-recorded" : ""}`} aria-hidden="true">{status === "recorded" ? <Check size={17} /> : <ClipboardList size={17} />}</span>
          <div className="min-w-0 flex-1"><Link className="testing-player-name" href={`/athletes/${athlete.id}`}>{athlete.name}<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <p className="mb-0 mt-1 text-xs text-[var(--text-secondary)]"><span className="font-mono">{athlete.athleteCode}</span>{athlete.jerseyNumber !== null ? ` · #${athlete.jerseyNumber}` : ""}{athlete.primaryPosition ? ` · ${athlete.primaryPosition}` : ""}</p>
          </div>
          <div className="testing-player-status"><span className="text-xs font-semibold">{status === "recorded" ? "Recorded" : "Needs Testing"}</span>{latest && <time className="mt-1 block text-xs text-[var(--text-secondary)]" dateTime={latest.measuredAt}>{testDate(latest.measuredAt)}</time>}</div>
          <Link href={`${entry}&athlete=${encodeURIComponent(athlete.athleteCode)}`} className="btn btn-secondary testing-row-action" aria-label={`Enter ${metric.label} for ${athlete.name}`}>{status === "recorded" ? "Add Result" : "Enter Result"}</Link>
        </li>)}
      </ul> : <div className="panel p-8 text-center"><ClipboardList className="mx-auto mb-3 text-[var(--text-secondary)]" size={28} aria-hidden="true" /><h3 className="text-base font-semibold">No Players Assigned to This Test</h3><p className="mb-0 text-sm text-[var(--text-secondary)]">Choose another test to see the players who need it.</p></div>}
    </section>
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm"><Link href="/imports" className="font-semibold text-[var(--text-primary)]">Import a File <ArrowUpRight className="inline" size={14} aria-hidden="true" /></Link><Link href="/admin/performance" className="text-[var(--text-secondary)]">Import History</Link></div>
  </div>;
}
