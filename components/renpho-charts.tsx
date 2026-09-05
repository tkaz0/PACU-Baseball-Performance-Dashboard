"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import type { Measurement } from "@/lib/imports/engine";
import type { ImportBatch } from "@/lib/local-workspace";
import { getRenphoReports, getRenphoChartReadings, getRenphoHistory, RENPHO_MASS_METRICS, RENPHO_PERCENT_METRICS } from "@/lib/renpho-charts";

const metricKey = (reading: Measurement) => JSON.stringify([reading.metric, reading.unit]);
const axisNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4, notation: value >= 1e7 || (value > 0 && value < 0.001) ? "scientific" : "standard" }).format(value);

// Bar lengths always start at zero. Guard rounding near Number.MAX_VALUE so a
// valid finite saved value cannot turn the entire scale into Infinity.
function scaleMaximum(values: number[]) {
  const maximum = Math.max(0, ...values);
  if (maximum === 0) return 1;
  const step = 10 ** Math.floor(Math.log10(maximum));
  const rounded = Math.ceil(maximum / step) * step;
  return Number.isFinite(rounded) && rounded >= maximum ? rounded : maximum;
}

function Scale({ maximum, unit }: { maximum: number; unit: string }) {
  return <div className="renpho-chart-scale" aria-hidden="true"><span>0</span><span>{axisNumber(maximum / 2)}</span><span>{axisNumber(maximum)} {unit}</span></div>;
}

function ReadingBars({ readings, maximum }: { readings: Measurement[]; maximum: number }) {
  return <ul className="renpho-bar-list">{readings.map(reading => <li key={reading.id} data-testid="renpho-bar" data-metric={reading.metric} data-value={reading.value} data-unit={reading.unit}>
    <div className="renpho-bar-label"><span>{reading.metric}</span><strong>{String(reading.value)} <small>{reading.unit}</small></strong></div>
    <div className="renpho-bar-track" aria-hidden="true"><span style={{ width: `${reading.value / maximum * 100}%` }} /></div>
  </li>)}</ul>;
}

export function RenphoCharts({ readings, batches, athleteCode }: { readings: Measurement[]; batches: ImportBatch[]; athleteCode: string }) {
  const [requestedReport, setRequestedReport] = useState("");
  const [requestedMetric, setRequestedMetric] = useState("");
  const reports = getRenphoReports(readings, batches, athleteCode);
  const report = reports.find(item => item.key === requestedReport) ?? reports[0];
  if (!report) return null;
  const chartReadings = getRenphoChartReadings(report);
  const massReadings = chartReadings.filter(reading => RENPHO_MASS_METRICS.some(metric => metric === reading.metric));
  const massUnits = [...new Set(massReadings.map(reading => reading.unit))].sort();
  const percentageReadings = chartReadings.filter(reading => RENPHO_PERCENT_METRICS.some(metric => metric === reading.metric) && reading.unit === "%");
  const otherReadings = chartReadings.filter(reading => !massReadings.includes(reading) && !percentageReadings.includes(reading));
  const metricChoices = [...new Map(reports.flatMap(item => getRenphoChartReadings(item)).map(reading => [metricKey(reading), reading])).entries()]
    .sort(([, a], [, b]) => (a.metric === "Weight" ? -1 : 0) - (b.metric === "Weight" ? -1 : 0) || a.metric.localeCompare(b.metric) || a.unit.localeCompare(b.unit));
  const historyMetric = metricChoices.find(([key]) => key === requestedMetric) ?? metricChoices[0];
  const history = historyMetric ? getRenphoHistory(reports, historyMetric[1].metric, historyMetric[1].unit) : [];
  const displayedHistory = history.slice(-12);
  const historyMaximum = historyMetric?.[1].unit === "%" ? 100 : scaleMaximum(displayedHistory.map(item => item.reading.value));
  const omitted = report.readings.length - chartReadings.length;
  const sameDateCounts = new Map<string, number>();
  for (const item of reports) sameDateCounts.set(item.reference.measured_at, (sameDateCounts.get(item.reference.measured_at) ?? 0) + 1);

  return <section className="renpho-charts" aria-label="RENPHO charts">
    <div className="renpho-charts-heading"><div><p className="eyebrow text-pacu-red"><BarChart3 size={16} aria-hidden="true" /> Report breakdown</p><h3>RENPHO charts</h3><p>Explore one report, then compare saved reports over time.</p></div>
      <label>RENPHO report<select value={report.key} onChange={event => setRequestedReport(event.target.value)}>{reports.map((item, index) => <option key={item.key} value={item.key}>{index === 0 ? "Latest · " : ""}{item.reference.measured_at} · {item.reference.source_file}{sameDateCounts.get(item.reference.measured_at)! > 1 ? ` · Report ${reports.length - index}` : ""}</option>)}</select></label>
    </div>
    <div className="renpho-selected-report" aria-live="polite"><span className="report-source-badge">RENPHO</span><p><strong>Test date <time dateTime={report.reference.measured_at}>{report.reference.measured_at}</time></strong><span>{report.reference.source_file} · {report.readings.length} saved readings</span></p></div>
    {omitted > 0 && <p className="notice renpho-chart-notice">{omitted} {omitted === 1 ? "reading is" : "readings are"} not charted because of duplicate measurements, unsupported units, or values outside the chart’s range. The saved values remain in measurement history.</p>}

    <div className="renpho-chart-grid">
      <div className="renpho-chart-panel renpho-mass-panel"><h4>Body mass measurements</h4><p className="renpho-chart-caption">{report.reference.measured_at} · Separate measurements in their saved units.</p>
        {massUnits.length ? massUnits.map(unit => {
          const group = massReadings.filter(reading => reading.unit === unit).sort((a, b) => RENPHO_MASS_METRICS.findIndex(metric => metric === a.metric) - RENPHO_MASS_METRICS.findIndex(metric => metric === b.metric));
          const maximum = scaleMaximum(group.map(reading => reading.value));
          return <figure key={unit} aria-label={`Body mass measurements (${unit})`} data-axis-min="0" data-axis-max={maximum}><figcaption className="renpho-unit-caption">Mass · {unit}</figcaption><Scale maximum={maximum} unit={unit} /><ReadingBars readings={group} maximum={maximum} /></figure>;
        }) : <p className="renpho-chart-empty">No mass measurements available to chart for this report.</p>}
        <p className="renpho-chart-note">These measurements overlap. Muscle, water, and other components are shown separately and are not added together.</p>
      </div>
      <div className="renpho-chart-side">
        <div className="renpho-chart-panel"><h4>Reported percentages</h4><p className="renpho-chart-caption">{report.reference.measured_at} · Each bar uses a 0–100% scale.</p>
          {percentageReadings.length ? <figure aria-label="Reported percentages" data-axis-min="0" data-axis-max="100"><Scale maximum={100} unit="%" /><ReadingBars readings={percentageReadings} maximum={100} /></figure> : <p className="renpho-chart-empty">No percentage measurements available to chart for this report.</p>}
          <p className="renpho-chart-note">Individual report percentages; they are not parts of a single total.</p>
        </div>
        {otherReadings.length > 0 && <div className="renpho-chart-panel"><h4>Other report measurements</h4><p className="renpho-chart-caption">{report.reference.measured_at} · Values shown in their own units.</p><dl className="renpho-indicator-grid">{otherReadings.map(reading => <div key={reading.id}><dt>{reading.metric}</dt><dd>{String(reading.value)} <span>{reading.unit}</span></dd></div>)}</dl></div>}
      </div>
    </div>

    <div className="renpho-chart-panel renpho-history-panel"><div className="renpho-history-heading"><div><h4>Report history</h4><p className="renpho-chart-caption">Compare the same measurement and unit across saved reports.</p></div>{historyMetric && <label>History measurement<select value={historyMetric[0]} onChange={event => setRequestedMetric(event.target.value)}>{metricChoices.map(([key, reading]) => <option key={key} value={key}>{reading.metric} ({reading.unit})</option>)}</select></label>}</div>
      {historyMetric && history.length ? <>
        <p className="renpho-history-context">{historyMetric[1].metric} ({historyMetric[1].unit}) · {displayedHistory[0].reading.measured_at}{displayedHistory.length > 1 ? ` to ${displayedHistory.at(-1)!.reading.measured_at}` : ""} · {history.length} {history.length === 1 ? "saved report" : "saved reports"}{history.length > 12 ? " · Showing the latest 12" : ""}</p>
        {history.length === 1 && <p className="renpho-baseline-note">Your first report is the starting point. Import another report to compare dates.</p>}
        <figure aria-label="Report history chart" data-axis-min="0" data-axis-max={historyMaximum}><Scale maximum={historyMaximum} unit={historyMetric[1].unit} /><ol className="renpho-bar-list renpho-history-bars">{displayedHistory.map(({ reportKey, reading }, index) => <li key={reportKey} data-testid="renpho-history-bar" data-metric={reading.metric} data-value={reading.value} data-unit={reading.unit} data-date={reading.measured_at} className={reportKey === report.key ? "is-selected-report" : undefined}>
          <div className="renpho-bar-label"><span><time dateTime={reading.measured_at}>{reading.measured_at}</time>{sameDateCounts.get(reading.measured_at)! > 1 && <small> · Report {reports.length - reports.findIndex(item => item.key === reportKey)}</small>}{reportKey === report.key && <em>Selected</em>}</span><strong>{String(reading.value)} <small>{reading.unit}</small></strong></div>
          <div className="renpho-bar-track" aria-hidden="true"><span style={{ width: `${reading.value / historyMaximum * 100}%` }} /></div>
          <span className="sr-only">Source: {reading.source_file}. Shown report {index + 1} of {displayedHistory.length}.</span>
        </li>)}</ol></figure>
        <p className="renpho-chart-note">Each bar is a separate report. Missing, duplicate, and unchartable measurements are skipped; units are kept separate. Bar length shows the saved value, not a target or rating.</p>
        <details className="renpho-chart-data"><summary>View chart values and sources</summary><div className="table-wrap"><table><caption className="sr-only">Values and sources for the displayed report history chart</caption><thead><tr><th>Date</th><th>Measurement</th><th>Value</th><th>Unit</th><th>Report source</th></tr></thead><tbody>{displayedHistory.map(({ reportKey, reading }) => <tr key={reportKey}><td>{reading.measured_at}</td><td>{reading.metric}</td><td>{String(reading.value)}</td><td>{reading.unit}</td><td className="break-words">{reading.source_file} · {reading.source_sheet} · Row {reading.source_row}</td></tr>)}</tbody></table></div></details>
      </> : <p className="renpho-chart-empty">No measurements available to chart. Review the saved readings in measurement history.</p>}
    </div>
  </section>;
}
