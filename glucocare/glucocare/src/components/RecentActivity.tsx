import { Activity, Droplet, History, Syringe, Utensils, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { DiabetesState } from '../types/diabetes';
import { formatGlucose } from '../utils/glucoseMath';
import { getGlucoseStatus } from '../utils/glucoseStatus';
import { formatDateTime } from '../utils/dateUtils';
import { Card, EmptyState } from './ui';

interface RecentActivityProps {
  state: DiabetesState;
  limit?: number;
}

interface Entry {
  id: string;
  time: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
  tone: string;
}

export default function RecentActivity({ state, limit = 12 }: RecentActivityProps) {
  const { unit, targetLowMmol, targetHighMmol } = state.settings;

  const entries = useMemo(() => {
    const list: Entry[] = [];
    // CGM is dense, so only manual fingersticks appear here.
    for (const g of state.glucose) {
      if (g.source !== 'fingerstick') continue;
      const s = getGlucoseStatus(g.valueMmol, targetLowMmol, targetHighMmol);
      list.push({
        id: g.id,
        time: g.timestamp,
        Icon: Droplet,
        title: `${formatGlucose(g.valueMmol, unit)} ${unit} (${s.label.toLowerCase()})`,
        detail: g.note ?? 'Fingerstick',
        tone: 'bg-rose-50 text-rose-700',
      });
    }
    for (const m of state.meals) {
      list.push({ id: m.id, time: m.timestamp, Icon: Utensils, title: `${m.name}`, detail: `${m.carbsG} g carbs · ${m.mealType}`, tone: 'bg-amber-50 text-amber-700' });
    }
    for (const d of state.insulin) {
      list.push({ id: d.id, time: d.timestamp, Icon: Syringe, title: `${d.units} U ${d.type}`, detail: d.note ?? d.insulinName, tone: 'bg-teal-50 text-teal-700' });
    }
    for (const e of state.exercise) {
      list.push({ id: e.id, time: e.timestamp, Icon: Activity, title: e.activity, detail: `${e.durationMin} min · ${e.intensity}`, tone: 'bg-emerald-50 text-emerald-700' });
    }
    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, limit);
  }, [state.glucose, state.meals, state.insulin, state.exercise, unit, targetLowMmol, targetHighMmol, limit]);

  return (
    <Card title="Recent activity" subtitle="Latest logs" icon={<History className="h-4 w-4" />}>
      {entries.length === 0 ? (
        <EmptyState title="Nothing logged yet." hint="Use the Log button to add glucose, meals, insulin or exercise." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map(({ id, time, Icon, title, detail, tone }) => (
            <li key={id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`} aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{title}</p>
                <p className="truncate text-xs text-slate-500">{detail}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500" dateTime={time}>
                {formatDateTime(time)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
