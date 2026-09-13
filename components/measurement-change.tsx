import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatMeasurementChange, type MeasurementChange as Change } from "@/lib/measurement-change";
import { formatHeight } from "@/lib/measurement-display";
import { leaderboardTestDate } from "@/lib/leaderboards";

export function MeasurementChange({ change, metric }: { change: Change | null | undefined; metric?: string }) {
  if (!change) return null;
  const previousDisplay = metric?.toLowerCase() === "height" ? formatHeight(change.previousValue, change.unit) : null;
  const Icon = change.difference > 0 ? ArrowUp : change.difference < 0 ? ArrowDown : Minus;
  const explanation = change.percent === null ? "Percentage change is unavailable because the previous result was zero."
    : `Relative change: (new − previous) ÷ previous × 100.${change.unit === "%" ? ` The absolute difference is ${Number(change.difference.toFixed(4))} percentage points.` : ""}`;
  return <span className="measurement-change" data-testid="measurement-change" data-tone={change.tone} data-change-percent={change.percent ?? undefined}>
    <span className="measurement-change-badge" title={explanation}><Icon size={12} aria-hidden="true"/>{formatMeasurementChange(change)}<span className="sr-only"> change since previous test</span></span>
    <span className="measurement-change-reference" title={`Previous result: ${change.previousValue} ${change.unit}. ${explanation}`}>vs. {previousDisplay ?? `${change.previousValue} ${change.unit}`} · <time dateTime={change.previousDate}>{leaderboardTestDate(change.previousDate)}</time></span>
  </span>;
}
