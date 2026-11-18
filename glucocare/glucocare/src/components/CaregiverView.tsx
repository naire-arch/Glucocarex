import { BellRing, Phone, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import type { DiabetesState } from '../types/diabetes';
import {
  buildAlertEvents,
  filterByDays,
  formatGlucose,
  latestReading,
  sortByTime,
} from '../utils/glucoseMath';
import {
  alertLevelStyle,
  getGlucoseStatus,
  TREND_LABEL,
  trendFromRate,
} from '../utils/glucoseStatus';
import { formatDateTime, formatDuration, timeAgo } from '../utils/dateUtils';
import GlucoseChart from './GlucoseChart';
import MedicationTracker from './MedicationTracker';
import { Card, EmptyState, Pill } from './ui';

interface CaregiverViewProps {
  state: DiabetesState;
}

const LEVEL_LABEL = {
  'urgent-low': 'Urgent low',
  low: 'Low',
  high: 'High',
  'urgent-high': 'Urgent high',
} as const;

export default function CaregiverView({ state }: CaregiverViewProps) {
  const { settings, glucose, meals, insulin, medications, medicationIntakes } = state;
  const { unit, targetLowMmol, targetHighMmol, patientName } = settings;

  const data = useMemo(() => {
    const now = new Date();
    const last = latestReading(glucose);
    const recent = sortByTime(filterByDays(glucose, 1, now));
    let trendText: string | null = null;
    if (recent.length >= 2) {
      const a = recent[recent.length - 2];
      const b = recent[recent.length - 1];
      const dtH = (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 3_600_000;
      if (dtH > 0 && dtH <= 0.75) trendText = TREND_LABEL[trendFromRate((b.valueMmol - a.valueMmol) / dtH)];
    }
    const events = buildAlertEvents(filterByDays(glucose, 7, now), targetLowMmol, targetHighMmol).slice(0, 12);
    const stale = last ? now.getTime() - new Date(last.timestamp).getTime() > 30 * 60 * 1000 : true;
    return { last, trendText, events, stale };
  }, [glucose, targetLowMmol, targetHighMmol]);

  const { last, trendText, events, stale } = data;
  const status = last ? getGlucoseStatus(last.valueMmol, targetLowMmol, targetHighMmol) : null;
  const critical = status?.key === 'urgent-low' || status?.key === 'low';

  return (
    <div className="space-y-5">
      {/* Live status banner */}
      <section
        aria-live="polite"
        aria-labelledby="live-status"
        className={`rounded-3xl border-2 p-5 shadow-sm sm:p-7 ${status ? `${status.bg} ${status.border}` : 'border-slate-200 bg-white'}`}
      >
        <h2 id="live-status" className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {patientName}: live status
        </h2>
        {last && status ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-baseline gap-3">
                <span className={`text-7xl font-extrabold tabular-nums sm:text-8xl ${status.text}`}>
                  {formatGlucose(last.valueMmol, unit)}
                </span>
                <span className="text-lg font-semibold text-slate-700">{unit}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pill className={`${status.solid} !px-3 !py-1 !text-sm`}>{status.label}</Pill>
                {trendText && <span className="text-sm font-medium text-slate-700">{trendText}</span>}
                <span className="text-sm text-slate-700">Updated {timeAgo(last.timestamp)}</span>
              </div>
            </div>
            <p className={`max-w-sm text-base font-medium ${status.text}`}>{status.message}</p>
          </div>
        ) : (
          <p className="mt-3 text-base text-slate-700">No readings have been shared yet.</p>
        )}
        {stale && last && (
          <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-slate-800">
            No new reading for over 30 minutes. Check the sensor or ask {patientName} for a fingerstick.
          </p>
        )}
      </section>

      {/* Emergency card */}
      <section
        aria-labelledby="emergency-title"
        className={`rounded-2xl border-2 bg-white p-4 shadow-sm sm:p-5 ${critical ? 'border-rose-500' : 'border-slate-200'}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-rose-700" aria-hidden="true" />
          <h2 id="emergency-title" className="text-base font-bold text-slate-900">
            Emergency card
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {settings.emergencyContacts.map((c) => (
            <li key={c.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-600">{c.relationship}</p>
              </div>
              <a
                href={`tel:${c.phone.replace(/\s/g, '')}`}
                className="btn-danger mt-3 w-full"
                aria-label={`Call ${c.name} on ${c.phone}`}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call {c.phone}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-950">
          <p className="font-semibold">If {patientName} is low and awake:</p>
          <p className="mt-0.5">Give 15 g fast-acting sugar (juice, soda, glucose tablets), wait 15 minutes, recheck.</p>
          <p className="mt-2 font-semibold">If drowsy, confused or unconscious:</p>
          <p className="mt-0.5">Do not put food or drink in the mouth. Place on their side and call emergency services now.</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Alert history" subtitle="Last 7 days, newest first" icon={<BellRing className="h-4 w-4" />}>
          {events.length === 0 ? (
            <EmptyState title="No high or low alerts in the last 7 days." />
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {events.map((e) => {
                const s = alertLevelStyle(e.level);
                const isLow = e.level === 'low' || e.level === 'urgent-low';
                return (
                  <li key={e.id} className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Pill className={s.solid}>{LEVEL_LABEL[e.level]}</Pill>
                      <span className="text-xs text-slate-700">{formatDateTime(e.start)}</span>
                    </div>
                    <p className={`mt-1.5 text-sm font-medium ${s.text}`}>
                      {isLow ? 'Lowest' : 'Peak'} {formatGlucose(e.extremeMmol, unit)} {unit} · lasted about{' '}
                      {formatDuration(e.durationMin)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <MedicationTracker
          medications={medications}
          intakes={medicationIntakes}
          onToggle={() => undefined}
          readOnly
        />
      </div>

      <GlucoseChart glucose={glucose} meals={meals} insulin={insulin} settings={settings} defaultRange="24H" title="Last 24 hours" />
      <p className="text-center text-xs text-slate-500">Caregiver view is read-only. Switch to Patient view to log data.</p>
    </div>
  );
}
