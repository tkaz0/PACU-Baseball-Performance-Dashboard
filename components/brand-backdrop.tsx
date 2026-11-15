/**
 * Decorative Pacific Baseball artwork (November 14 owner request: branding instead of player photos, so
 * nothing goes stale as the roster changes). A field diagram, baseball seams and the official athletics
 * "P" at its original proportions. Purely decorative and hidden from assistive technology.
 */
import { BaseballMark } from "@/components/baseball-mark";

export function BrandBackdrop({ className = "" }: { className?: string }) {
  return <div className={`brand-backdrop ${className}`} aria-hidden="true">
    <svg className="brand-backdrop-field" viewBox="0 0 600 420" preserveAspectRatio="xMaxYMid slice">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M300 395 L20 115 M300 395 L580 115" strokeWidth="1.6"/>
        <path d="M20 115 Q300 -150 580 115" strokeWidth="1.6"/>
        <path d="M176 271 Q300 105 424 271" strokeWidth="1.2" strokeDasharray="2 7"/>
        <path d="M300 395 L424 271 L300 147 L176 271 Z" strokeWidth="1.8"/>
        <circle cx="300" cy="280" r="15" strokeWidth="1.4"/>
        <path d="M290 395 L300 405 L310 395 L310 386 L290 386 Z" strokeWidth="1.4"/>
        {[[424, 271], [300, 147], [176, 271]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width="12" height="12" transform={`rotate(45 ${x} ${y})`} strokeWidth="1.4"/>)}
      </g>
    </svg>
    <BaseballMark className="brand-backdrop-ball"/>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="brand-backdrop-mark" src="/brand/pacific-athletics-p.png" alt=""/>
  </div>;
}
