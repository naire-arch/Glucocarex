import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GlucoseLog, GlucoseSource, GlucoseUnit, InsulinDose, MealLog, UserSettings } from '../types/diabetes';
import { CGM_INTERVAL_MIN, filterByDays, formatGlucose, sortByTime, toDisplayValue } from '../utils/glucoseMath';
import { getGlucoseStatus } from '../utils/glucoseStatus';
import { Card } from './ui';

export type ChartRange = '24H' | '7D' | '14D';

interface GlucoseChartProps {
  glucose: GlucoseLog[];
  meals: MealLog[];
  insulin: InsulinDose[];
  settings: UserSettings;
  defaultRange?: ChartRange;
  title?: string;
}

interface ChartPoint {
  t: number;
  /** Value in the display unit, or null to break the line across sensor gaps. */
  value: number | null;
  valueMmol: number | null;
  source: GlucoseSource;
  meals?: string[];
  doses?: string[];
}

interface EventPoint {
  t: number;
  y: number;
}

const RANGES: ChartRange[] = ['24H', '7D', '14D'];
const RANGE_DAYS: Record<ChartRange, number> = { '24H': 1, '7D': 7, '14D': 14 };
const GAP_MS = 35 * 60 * 1000;
const EVENT_MATCH_MS = 20 * 60 * 1000;

function buildTicks(startMs: number, endMs: number, range: ChartRange): number[] {
  const ticks: number[] = [];
  if (range === '24H') {
    const d = new Date(startMs);
    d.setMinutes(0, 0, 0);
    while (d.getTime() < startMs || d.getHours() % 4 !== 0) {
      d.setHours(d.getHours() + 1);
    }
    let t = d.getTime();
    while (t <= endMs) {
      ticks.push(t);
      const next = new Date(t);
      next.setHours(next.getHours() + 4);
      t = next.getTime();
    }
    return ticks;
  }
  const stepDays = range === '7D' ? 1 : 2;
  const d = new Date(startMs);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < startMs) d.setDate(d.getDate() + 1);
  let t = d.getTime();
  while (t <= endMs) {
    ticks.push(t);
    const next = new Date(t);
    next.setDate(next.getDate() + stepDays);
    t = next.getTime();
  }
  return ticks;
}

function nearestIndex(points: ChartPoint[], t: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1].t - t) <= Math.abs(points[lo].t - t)) return lo - 1;
  return lo;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  unit: GlucoseUnit;
  low: number;
  high: number;
}

function ChartTooltip({ active, payload, unit, low, high }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point || point.value === null || point.valueMmol === null) return null;
  const status = getGlucoseStatus(point.valueMmol, low, high);
  const when = new Date(point.t).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="max-w-[16rem] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="text-xs text-slate-500">{when}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-xl font-bold tabular-nums ${status.text}`}>{formatGlucose(point.valueMmol, unit)}</span>
        <span className="text-xs text-slate-500">{unit}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${status.solid}`}>{status.label}</span>
      </p>
      <p className="text-xs text-slate-500">{point.source === 'cgm' ? 'CGM reading' : 'Fingerstick'}</p>
      {point.meals && point.meals.length > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          <span className="font-semibold">Meal:</span> {point.meals.join('; ')}
        </p>
      )}
      {point.doses && point.doses.length > 0 && (
        <p className="mt-1 text-xs text-teal-800">
          <span className="font-semibold">Insulin:</span> {point.doses.join('; ')}
        </p>
      )}
    </div>
  );
}

export default function GlucoseChart({
  glucose,
  meals,
  insulin,
  settings,
  defaultRange = '24H',
  title = 'Glucose trend',
}: GlucoseChartProps) {
  const [range, setRange] = useState<ChartRange>(defaultRange);
  const { unit, targetLowMmol, targetHighMmol } = settings;

  const chart = useMemo(() => {
    const endMs = Date.now();
    const startMs = endMs - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
    const now = new Date(endMs);

    const readings = sortByTime(filterByDays(glucose, RANGE_DAYS[range], now));
    const points: ChartPoint[] = [];
    readings.forEach((g, i) => {
      const t = new Date(g.timestamp).getTime();
      const prev = readings[i - 1];
      if (prev && t - new Date(prev.timestamp).getTime() > GAP_MS) {
        points.push({ t: t - 1, value: null, valueMmol: null, source: g.source });
      }
      points.push({
        t,
        value: toDisplayValue(g.valueMmol, unit),
        valueMmol: g.valueMmol,
        source: g.source,
      });
    });

    const mealList = meals.filter((m) => {
      const t = new Date(m.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });
    const doseList = insulin.filter((d) => {
      const t = new Date(d.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });

    const attach = points.filter((p) => p.value !== null);
    const attachEvent = (iso: string, key: 'meals' | 'doses', text: string): void => {
      if (attach.length === 0) return;
      const t = new Date(iso).getTime();
      const idx = nearestIndex(attach, t);
      const target = attach[idx];
      if (target && Math.abs(target.t - t) <= EVENT_MATCH_MS) {
        target[key] = [...(target[key] ?? []), text];
      }
    };
    for (const m of mealList) attachEvent(m.timestamp, 'meals', `${m.name} (${m.carbsG} g carbs)`);
    for (const d of doseList) {
      const label = d.type === 'basal' ? 'Basal' : d.type === 'correction' ? 'Correction' : 'Bolus';
      attachEvent(d.timestamp, 'doses', `${label} ${d.units} U`);
    }

    const values = points.map((p) => p.value).filter((v): v is number => v !== null);
    const dataMax = values.length ? Math.max(...values) : 0;
    const dataMin = values.length ? Math.min(...values) : 0;
    const yMax =
      unit === 'mmol/L' ? Math.max(14, Math.ceil(dataMax + 1)) : Math.max(250, Math.ceil((dataMax + 10) / 10) * 10);
    const yMin = unit === 'mmol/L' ? Math.min(2, Math.floor(dataMin)) : Math.min(40, Math.floor(dataMin / 10) * 10);
    const span = yMax - yMin;
    const mealY = yMin + span * 0.05;
    const doseY = yMin + span * 0.11;

    const mealPts: EventPoint[] = mealList.map((m) => ({ t: new Date(m.timestamp).getTime(), y: mealY }));
    const dosePts: EventPoint[] = doseList.map((d) => ({ t: new Date(d.timestamp).getTime(), y: doseY }));

    return {
      startMs,
      endMs,
      points,
      mealPts,
      dosePts,
      yMin,
      yMax,
      ticks: buildTicks(startMs, endMs, range),
      readingCount: readings.length,
      expectedCount: (RANGE_DAYS[range] * 24 * 60) / CGM_INTERVAL_MIN,
    };
  }, [glucose, meals, insulin, range, unit]);

  const lowDisplay = toDisplayValue(targetLowMmol, unit);
  const highDisplay = toDisplayValue(targetHighMmol, unit);

  const formatTick = (t: number): string =>
    range === '24H'
      ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Card
      title={title}
      subtitle={`Target ${formatGlucose(targetLowMmol, unit)}–${formatGlucose(targetHighMmol, unit)} ${unit}`}
      icon={<TrendingUp className="h-4 w-4" />}
      action={
        <div role="group" aria-label="Chart time range" className="flex rounded-lg bg-slate-100 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-[36px] rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                range === r ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      {chart.readingCount === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
          No glucose readings in this time range.
        </div>
      ) : (
        <div
          className="h-72 w-full sm:h-80"
          role="img"
          aria-label={`Glucose trend chart for the last ${range}, ${chart.readingCount} readings, with target range shaded.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart.points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[chart.startMs, chart.endMs]}
                ticks={chart.ticks}
                tickFormatter={formatTick}
                tick={{ fontSize: 11, fill: '#475569' }}
                stroke="#94a3b8"
                allowDataOverflow
              />
              <YAxis
                domain={[chart.yMin, chart.yMax]}
                tick={{ fontSize: 11, fill: '#475569' }}
                stroke="#94a3b8"
                allowDecimals={unit === 'mmol/L'}
                tickCount={7}
                width={44}
              />
              <ReferenceArea y1={lowDisplay} y2={highDisplay} fill="#10b981" fillOpacity={0.14} stroke="none" />
              <ReferenceLine y={lowDisplay} stroke="#e11d48" strokeDasharray="4 4" strokeWidth={1.25} />
              <ReferenceLine y={highDisplay} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1.25} />
              <Tooltip
                content={<ChartTooltip unit={unit} low={targetLowMmol} high={targetHighMmol} />}
                cursor={{ stroke: '#0f766e', strokeWidth: 1, strokeDasharray: '3 3' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Scatter
                name="Meals"
                data={chart.mealPts}
                dataKey="y"
                fill="#d97706"
                shape="circle"
                isAnimationActive={false}
                tooltipType="none"
              />
              <Scatter
                name="Insulin"
                data={chart.dosePts}
                dataKey="y"
                fill="#0f766e"
                shape="triangle"
                isAnimationActive={false}
                tooltipType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Chart legend">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-teal-700" aria-hidden="true" /> Glucose
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-emerald-500/20 ring-1 ring-emerald-500/40" aria-hidden="true" /> Target range
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" /> Meal
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-teal-700"
            aria-hidden="true"
          />{' '}
          Insulin
        </li>
      </ul>
    </Card>
  );
}
