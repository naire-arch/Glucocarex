import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DiabetesState } from '../types/diabetes';
import {
  buildEventsCsv,
  buildReportSummary,
  buildSummaryCsv,
  downloadTextFile,
  printReport,
  reportFilename,
} from '../utils/exportReport';
import { formatGlucose } from '../utils/glucoseMath';
import { Card } from './ui';

interface DoctorReportViewProps {
  state: DiabetesState;
}

const PERIODS = [7, 14] as const;

const TIR_BANDS = [
  { key: 'veryLow', label: 'Very low (<3.0 mmol/L)', color: 'bg-rose-700', target: '<1%' },
  { key: 'low', label: 'Low (3.0–3.8 mmol/L)', color: 'bg-rose-400', target: '<4% (with very low)' },
  { key: 'inRange', label: 'In range (3.9–10.0 mmol/L)', color: 'bg-emerald-500', target: '>70%' },
  { key: 'high', label: 'High (10.1–13.9 mmol/L)', color: 'bg-amber-400', target: '<25% (with very high)' },
  { key: 'veryHigh', label: 'Very high (>13.9 mmol/L)', color: 'bg-amber-600', target: '<5%' },
] as const;

export default function DoctorReportView({ state }: DoctorReportViewProps) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14);
  const { settings } = state;
  const { unit } = settings;

  const summary = useMemo(() => buildReportSummary(state, days), [state, days]);
  const f = (mmol: number): string => formatGlucose(mmol, unit);
  const hasData = summary.readings > 0;

  const downloadSummary = (): void => {
    downloadTextFile(reportFilename('glucocare-summary'), buildSummaryCsv(summary, state));
  };
  const downloadEvents = (): void => {
    downloadTextFile(reportFilename('glucocare-events'), buildEventsCsv(state, unit, days));
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Report period" className="flex rounded-lg bg-slate-200 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={`min-h-[40px] rounded-md px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                days === p ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {p} days
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={downloadSummary} disabled={!hasData}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Summary CSV
          </button>
          <button type="button" className="btn-primary" onClick={downloadEvents} disabled={!hasData}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download data CSV
          </button>
          <button type="button" className="btn-secondary" onClick={printReport}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print report
          </button>
        </div>
      </div>

      {/* Report header (visible on screen and in print) */}
      <Card report>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Glucose report</h2>
            <p className="text-sm text-slate-600">
              Patient: <span className="font-semibold text-slate-900">{settings.patientName}</span>
            </p>
            <p className="text-sm text-slate-600">
              Period: {summary.from} to {summary.to} ({summary.days} days)
            </p>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <p>Units: {unit}</p>
            <p>
              Target range: {f(settings.targetLowMmol)}–{f(settings.targetHighMmol)} {unit}
            </p>
            <p>Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      {!hasData ? (
        <Card>
          <p className="text-sm text-slate-600">No glucose data in this period. Log readings first, or load demo data from the footer.</p>
        </Card>
      ) : (
        <>
          <Card report title="Clinical summary" subtitle="Consensus CGM metrics">
            <div className="overflow-x-auto">
              <table className="report-table w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">Clinical summary metrics</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Metric</th>
                    <th scope="col" className="py-2 pr-3">Value</th>
                    <th scope="col" className="py-2">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Mean glucose</th><td className="pr-3">{f(summary.avgMmol)} {unit}</td><td className="text-slate-500">–</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Estimated HbA1c</th><td className="pr-3">{summary.eA1c.toFixed(1)}% ({summary.eA1cMmolMol.toFixed(0)} mmol/mol)</td><td className="text-slate-500">Target &lt;7.0% for most adults</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">GMI</th><td className="pr-3">{summary.gmi.toFixed(1)}%</td><td className="text-slate-500">–</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Variability (SD / CV)</th><td className="pr-3">{f(summary.sdMmol)} {unit} / {summary.cvPercent.toFixed(0)}%</td><td className="text-slate-500">CV ≤36% stable</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Range observed</th><td className="pr-3">{f(summary.minMmol)}–{f(summary.maxMmol)} {unit}</td><td className="text-slate-500">–</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Readings / CGM active</th><td className="pr-3">{summary.readings} / {summary.cgmActivePercent.toFixed(0)}%</td><td className="text-slate-500">≥70% for reliable metrics</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Hypoglycemia episodes</th><td className="pr-3">{summary.episodes.hypoEpisodes} ({summary.episodes.severeHypoEpisodes} severe)</td><td className="text-slate-500">Severe = below 3.0 mmol/L</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Hyperglycemia episodes</th><td className="pr-3">{summary.episodes.hyperEpisodes} ({summary.episodes.severeHyperEpisodes} severe)</td><td className="text-slate-500">Severe = above 13.9 mmol/L</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Avg daily carbs</th><td className="pr-3">{summary.avgDailyCarbsG.toFixed(0)} g</td><td className="text-slate-500">–</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Avg daily insulin</th><td className="pr-3">{summary.avgDailyRapidUnits.toFixed(1)} U rapid + {summary.avgDailyBasalUnits.toFixed(1)} U basal</td><td className="text-slate-500">–</td></tr>
                  <tr><th scope="row" className="py-2 pr-3 font-medium">Medication adherence</th><td className="pr-3">{summary.adherencePercent.toFixed(0)}% ({summary.dosesTaken}/{summary.dosesDue} doses)</td><td className="text-slate-500">Streak: {summary.adherenceStreakDays} days</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card report title="Time in ranges" subtitle="Share of readings per glucose band">
            <div
              className="flex h-6 w-full overflow-hidden rounded-full bg-slate-200"
              role="img"
              aria-label={`Time in range ${summary.tir.inRange.toFixed(0)} percent`}
            >
              {TIR_BANDS.map((b) =>
                summary.tir[b.key] > 0 ? (
                  <div key={b.key} className={b.color} style={{ width: `${summary.tir[b.key]}%` }} />
                ) : null,
              )}
            </div>
            <table className="report-table mt-4 w-full text-left text-sm">
              <caption className="sr-only">Time in each glucose range</caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">Range</th>
                  <th scope="col" className="py-2 pr-3">Time</th>
                  <th scope="col" className="py-2">Goal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TIR_BANDS.map((b) => (
                  <tr key={b.key}>
                    <th scope="row" className="py-2 pr-3 font-medium">
                      <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${b.color}`} aria-hidden="true" />
                      {b.label}
                    </th>
                    <td className="pr-3 tabular-nums">{summary.tir[b.key].toFixed(1)}%</td>
                    <td className="text-slate-500">{b.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card report title="Ambulatory glucose profile (AGP) summary" subtitle={`Glucose by time of day (${unit}), 2-hour blocks`}>
            <div className="overflow-x-auto">
              <table className="report-table w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Glucose percentiles by time of day</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Time</th>
                    <th scope="col" className="py-2 pr-3">n</th>
                    <th scope="col" className="py-2 pr-3">10th</th>
                    <th scope="col" className="py-2 pr-3">25th</th>
                    <th scope="col" className="py-2 pr-3">Median</th>
                    <th scope="col" className="py-2 pr-3">75th</th>
                    <th scope="col" className="py-2 pr-3">90th</th>
                    <th scope="col" className="py-2">% in range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.agp.map((b) => {
                    const flagLow = b.count > 0 && b.p10 < settings.targetLowMmol;
                    const flagHigh = b.count > 0 && b.p90 > settings.targetHighMmol;
                    return (
                      <tr key={b.label}>
                        <th scope="row" className="py-1.5 pr-3 font-medium tabular-nums">{b.label}</th>
                        <td className="pr-3 tabular-nums text-slate-500">{b.count}</td>
                        <td className={`pr-3 tabular-nums ${flagLow ? 'font-semibold text-rose-700' : ''}`}>{b.count ? f(b.p10) : '–'}</td>
                        <td className="pr-3 tabular-nums">{b.count ? f(b.p25) : '–'}</td>
                        <td className="pr-3 font-semibold tabular-nums">{b.count ? f(b.median) : '–'}</td>
                        <td className="pr-3 tabular-nums">{b.count ? f(b.p75) : '–'}</td>
                        <td className={`pr-3 tabular-nums ${flagHigh ? 'font-semibold text-amber-700' : ''}`}>{b.count ? f(b.p90) : '–'}</td>
                        <td className="tabular-nums">{b.count ? `${b.percentInRange.toFixed(0)}%` : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Red 10th percentile: lows likely in this window. Amber 90th percentile: highs likely in this window.
            </p>
          </Card>
        </>
      )}

      <p className="print-only text-xs text-slate-600">
        GlucoCare is for informational and educational use and does not replace professional medical advice. Estimated HbA1c
        is calculated from average glucose and is not a laboratory result.
      </p>
    </div>
  );
}
