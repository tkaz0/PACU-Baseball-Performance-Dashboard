import Link from "next/link";
import { ChartScatter, Grid2X2 } from "lucide-react";
export function AnalyticsNavigation({ current }: { current: "scatter" | "map" }) {
  return <nav className="leaderboard-navigation mb-6" aria-label="Analytics view"><Link href="/analytics" aria-current={current === "scatter" ? "page" : undefined}><ChartScatter size={16} aria-hidden="true" />Compare Two Stats</Link><Link href="/analytics/matrix" aria-current={current === "map" ? "page" : undefined}><Grid2X2 size={16} aria-hidden="true" />Correlation Map</Link></nav>;
}
