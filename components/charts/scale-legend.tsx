/** Explains the blue → red team scale used by percentile markers and benchmark bands. */
export function ScaleLegend({ low = "Lower on team", high = "Higher on team", note }: { low?: string; high?: string; note?: string }) {
  return <div className="scale-legend" role="note"><span>{low}</span><i aria-hidden="true"/><span>{high}</span>{note && <small>{note}</small>}</div>;
}
