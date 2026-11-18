import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUp, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { GlucoseLog, UserSettings } from '../types/diabetes';
import {
  a1cPercentToMmolMol,
  average,
  coefficientOfVariation,
  estimateA1c,
  filterByDays,
  formatGlucose,
  glucoseManagementIndicator,
  latestReading,
  sortByTime,
  standardDeviation,
  timeInRange,
} from '../utils/glucoseMath';
import { getGlucoseStatus, TREND_LABEL, trendFromRate, type TrendDirection } from '../utils/glucoseStatus';
import { timeAgo } from '../utils/dateUtils';
import { Card, Pill } from './ui';

interface DashboardMetricsProps {
  glucose: GlucoseLog[];
  settings: UserSettings;
  periodDays?: number;
}

const TREND_ICON: Record<TrendDirection, LucideIcon> = {
  'rising-fast': ArrowUp,
  rising: ArrowUpRight,
  steady: ArrowRight,
  falling: ArrowDownRight,
  'falling-fast': ArrowDown,
};

const BANDS = [
  { key: 'veryLow', label: 'Very low', color: 'bg-rose-700' },
  { key: 'low', label: 'Low', color: 'bg-rose-400' },
  { key: 'inRange', label: 'In range', color: 'bg-emerald-500' },
  { key: 'high', label: 'High', color: 'bg-amber-400' },
  { key: 'veryHigh', label: 'Very high', color: 'bg-amber-600' },
] as const;

export default function DashboardMetrics({ glucose, settings, periodDays = 14 }: DashboardMetricsProps) {
  const { unit, targetLowMmol, targetHighMmol } = settings;

  const metrics = useMemo(() => {
    const now = new Date();
    const windowLogs = sortByTime(filterByDays(glucose, periodDays, now));
    const values = windowLogs.map((g) => g.valueMmol);
    const avg = average(values);
    const a1c = estimateA1c(avg);
    const last = latestReading(glucose);

    let trend: TrendDirection | null = null;
    if (windowLogs.length >= 2) {
      const latest = windowLogs[windowLogs.length - 1];
      const prev = windowLogs[windowLogs.length - 2];
      const dtH = (new Date(latest.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3_600_000;
      if (dtH > 0 && dtH <= 0.75) {
        trend = trendFromRate((latest.valueMmol - prev.valueMmol) / dtH);
      }
    }

    return {
      last,
      trend,
      avg,
      sd: standardDeviation(values),
      cv: coefficientOfVariation(values),
      a1c,
      a1cMmolMol: a1cPercentToMmolMol(a1c),
      gmi: glucoseManagementIndicator(avg),
      tir: timeInRange(windowLogs, targetLowMmol, targetHighMmol),
      count: windowLogs.length,
    };
  }, [glucose, periodDays, targetLowMmol, targetHighMmol]);

  const { last, trend, tir } = metrics;
  const status = last ? getGlucoseStatus(last.valueMmol, targetLowMmol, targetHighMmol) : null;
  const TrendIcon = trend ? TREND_ICON[trend] : null;
  const hasData = metrics.count > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key glucose metrics">
      {/* Current BG */}
      <section
        className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${status ? `${status.bg} ${status.border}` : 'border-slate-200 bg-white'}`}
        aria-labelledby="metric-current"
      >
        <h2 id="metric-current" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Current glucose
        </h2>
        {last && status ? (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className={`text-5xl font-bold tabular-nums ${status.text}`}>
                {formatGlucose(last.valueMmol, unit)}
              </span>
              <span className="text-sm font-medium text-slate-600">{unit}</span>
              {TrendIcon && trend && (
                <span className={`ml-auto flex items-center gap-1 text-sm font-semibold ${status.text}`}>
                  <TrendIcon className="h-6 w-6" aria-hidden="true" />
                  <span className="sr-only">{TREND_LABEL[trend]}</span>
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill className={status.solid}>{status.label}</Pill>
              {trend && <span className="text-xs text-slate-600">{TREND_LABEL[trend]}</span>}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Updated {timeAgo(last.timestamp)} ({last.source === 'cgm' ? 'CGM' : 'fingerstick'})
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No readings yet. Use “Log” to add your first glucose value.</p>
        )}
      </section>

      {/* Time in range */}
      <Card className="sm:col-span-1" title="Time in range" subtitle={`Last ${periodDays} days`}>
        {hasData ? (
          <>
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {tir.inRange.toFixed(0)}
              <span className="text-lg font-semibold text-slate-500">%</span>
            </p>
            <div
              className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-slate-200"
              role="img"
              aria-label={`Time in range breakdown: ${BANDS.map((b) => `${b.label} ${tir[b.key].toFixed(0)} percent`).join(', ')}`}
            >
              {BANDS.map((b) =>
                tir[b.key] > 0 ? (
                  <div key={b.key} className={b.color} style={{ width: `${tir[b.key]}%` }} title={`${b.label}: ${tir[b.key].toFixed(1)}%`} />
                ) : null,
              )}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              {BANDS.map((b) => (
                <li key={b.key} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${b.color}`} aria-hidden="true" />
                  {b.label} {tir[b.key].toFixed(0)}%
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Target: {formatGlucose(targetLowMmol, unit)}–{formatGlucose(targetHighMmol, unit)} {unit}; goal above 70%.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">Not enough data yet.</p>
        )}
      </Card>

      {/* Average */}
      <Card title={`${periodDays}-day average`} subtitle="Mean glucose">
        {hasData ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-slate-900">{formatGlucose(metrics.avg, unit)}</span>
              <span className="text-sm font-medium text-slate-500">{unit}</span>
            </p>
            <dl className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt>Variability (SD)</dt>
                <dd className="font-medium text-slate-800">
                  {formatGlucose(metrics.sd, unit)} {unit}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>CV</dt>
                <dd className="font-medium text-slate-800">
                  {metrics.cv.toFixed(0)}%{' '}
                  <span className={metrics.cv <= 36 ? 'text-emerald-700' : 'text-amber-700'}>
                    {metrics.cv <= 36 ? '(stable)' : '(high)'}
                  </span>
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm text-slate-600">Not enough data yet.</p>
        )}
      </Card>

      {/* eA1c */}
      <Card title="Estimated HbA1c" subtitle="From average glucose">
        {hasData ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-slate-900">{metrics.a1c.toFixed(1)}</span>
              <span className="text-sm font-medium text-slate-500">%</span>
            </p>
            <dl className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt>In mmol/mol</dt>
                <dd className="font-medium text-slate-800">{metrics.a1cMmolMol.toFixed(0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>GMI</dt>
                <dd className="font-medium text-slate-800">{metrics.gmi.toFixed(1)}%</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">An estimate only. A laboratory HbA1c test is the reference.</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">Not enough data yet.</p>
        )}
      </Card>
    </div>
  );
}
