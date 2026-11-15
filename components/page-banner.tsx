import type { ReactNode } from "react";
import { BrandBackdrop } from "@/components/brand-backdrop";
import { CountUp } from "@/components/count-up";

/** Branded page header with headline numbers (presentation only; values come from the page's own readers). */
export function PageBanner({ section, title, description, stats = [], children }: { section: string; title: string; description: string; stats?: { label: string; value: string }[]; children?: ReactNode }) {
  return <header className="page-banner">
    <BrandBackdrop/>
    <div className="page-banner-top">
      <div className="min-w-0"><p className="page-banner-eyebrow">{section}</p><h1 className="page-title">{title}</h1><p className="page-banner-description">{description}</p></div>
      {children && <div className="page-banner-actions">{children}</div>}
    </div>
    {stats.length > 0 && <dl className="page-banner-stats">{stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd><CountUp value={stat.value}/></dd></div>)}</dl>}
  </header>;
}
