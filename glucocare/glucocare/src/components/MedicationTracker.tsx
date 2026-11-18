import { Check, Flame, Pill as PillIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { Medication, MedicationIntake } from '../types/diabetes';
import { computeAdherence, isTaken } from '../utils/adherence';
import { toLocalDateKey, toLocalTime } from '../utils/dateUtils';
import { Card, Pill } from './ui';

interface MedicationTrackerProps {
  medications: Medication[];
  intakes: MedicationIntake[];
  onToggle: (medicationId: string) => void;
  /** Read-only mode for caregiver/doctor views. */
  readOnly?: boolean;
}

const KIND_LABEL: Record<Medication['kind'], string> = {
  'basal-insulin': 'Basal insulin',
  oral: 'Oral medication',
  other: 'Other',
};

export default function MedicationTracker({ medications, intakes, onToggle, readOnly = false }: MedicationTrackerProps) {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const nowTime = toLocalTime(now);

  const adherence = useMemo(
    () => computeAdherence({ medications, medicationIntakes: intakes }, 14, new Date()),
    [medications, intakes],
  );

  const sorted = useMemo(
    () => [...medications].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [medications],
  );

  const takenToday = sorted.filter((m) => isTaken(intakes, m.id, todayKey)).length;

  // Last 7 days dots (oldest first).
  const week = useMemo(() => {
    const days: Array<{ key: string; label: string; taken: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      days.push({
        key,
        label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        taken: medications.filter((m) => isTaken(intakes, m.id, key)).length,
      });
    }
    return days;
  }, [medications, intakes]);

  return (
    <Card
      id="meds"
      title="Medications"
      subtitle={`${takenToday} of ${sorted.length} taken today`}
      icon={<PillIcon className="h-4 w-4" />}
      action={
        <Pill className="bg-amber-100 text-amber-900">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          {adherence.streakDays}-day streak
        </Pill>
      }
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-600">No medications scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((med) => {
            const taken = isTaken(intakes, med.id, todayKey);
            const overdue = !taken && med.scheduledTime < nowTime;
            return (
              <li
                key={med.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  taken ? 'border-emerald-200 bg-emerald-50' : overdue ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={taken}
                  aria-label={`${med.name} ${med.dose} at ${med.scheduledTime}`}
                  disabled={readOnly}
                  onClick={() => onToggle(med.id)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
                    taken ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-transparent hover:border-teal-600'
                  } ${readOnly ? 'cursor-default' : ''}`}
                >
                  <Check className="h-6 w-6" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {med.name} <span className="font-normal text-slate-600">· {med.dose}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {KIND_LABEL[med.kind]}
                    {med.instructions ? ` · ${med.instructions}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-800">{med.scheduledTime}</p>
                  <p className={`text-xs font-medium ${taken ? 'text-emerald-800' : overdue ? 'text-amber-800' : 'text-slate-500'}`}>
                    {taken ? 'Taken' : overdue ? 'Overdue' : 'Upcoming'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">14-day adherence</p>
          <p className="text-xl font-bold tabular-nums text-slate-900">{adherence.percent.toFixed(0)}%</p>
        </div>
        <div className="flex items-end gap-1.5" role="img" aria-label="Medications taken over the last 7 days">
          {week.map((d) => {
            const full = medications.length > 0 && d.taken >= medications.length;
            const partial = d.taken > 0 && !full;
            return (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <span
                  className={`h-5 w-5 rounded-full ${full ? 'bg-emerald-500' : partial ? 'bg-amber-400' : 'bg-slate-300'}`}
                  title={`${d.key}: ${d.taken} of ${medications.length} taken`}
                />
                <span className="text-[10px] text-slate-500">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {readOnly && <p className="mt-2 text-xs text-slate-500">Read-only view. Only the patient can tick off doses.</p>}
    </Card>
  );
}
