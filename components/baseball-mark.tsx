/** A baseball with stitched seams, drawn in currentColor. Decorative only. */
const STITCHES = Array.from({ length: 14 }, (_, i) => i);
export function BaseballMark({ className = "", strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={strokeWidth}>
      <circle cx="100" cy="100" r="96"/>
      <path d="M42 22 Q86 100 42 178"/>
      <path d="M158 22 Q114 100 158 178"/>
      {STITCHES.map(i => { const t = (i + 0.5) / STITCHES.length, y = 22 + t * 156, bow = 4 * t * (1 - t) * 44; return <g key={i}>
        <path d={`M${42 + bow - 7} ${y - 4} L${42 + bow + 7} ${y + 3}`}/>
        <path d={`M${158 - bow + 7} ${y - 4} L${158 - bow - 7} ${y + 3}`}/>
      </g>; })}
    </g>
  </svg>;
}
