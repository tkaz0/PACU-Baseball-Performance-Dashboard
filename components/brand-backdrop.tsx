/**
 * Decorative Pacific Baseball artwork (November 14 owner request: branding instead of player photos, so
 * nothing goes stale as the roster changes). A field diagram, baseball seams and the official athletics
 * "P" at its original proportions. Purely decorative and hidden from assistive technology.
 */
const STITCHES = Array.from({ length: 14 }, (_, i) => i);
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
    <svg className="brand-backdrop-ball" viewBox="0 0 200 200">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <circle cx="100" cy="100" r="96" strokeWidth="2"/>
        <path d="M42 22 Q86 100 42 178" strokeWidth="2"/>
        <path d="M158 22 Q114 100 158 178" strokeWidth="2"/>
        {STITCHES.map(i => { const t = (i + 0.5) / STITCHES.length, y = 22 + t * 156, bow = 4 * t * (1 - t) * 44; return <g key={i} strokeWidth="2">
          <path d={`M${42 + bow - 7} ${y - 4} L${42 + bow + 7} ${y + 3}`}/>
          <path d={`M${158 - bow + 7} ${y - 4} L${158 - bow - 7} ${y + 3}`}/>
        </g>; })}
      </g>
    </svg>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="brand-backdrop-mark" src="/brand/pacific-athletics-p.png" alt=""/>
  </div>;
}
