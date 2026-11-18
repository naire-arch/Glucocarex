import { AlertTriangle, Calculator, CheckCircle2, ShieldAlert, Syringe } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GlucoseLog, InsulinDose, UserSettings } from '../types/diabetes';
import {
  calculateBolus,
  calculateIob,
  formatGlucose,
  fromDisplayValue,
  HYPO_PROTOCOL,
  HYPO_THRESHOLD_MMOL,
  latestReading,
  round,
  validInputRange,
} from '../utils/glucoseMath';
import { makeId, timeAgo } from '../utils/dateUtils';
import { RAPID_INSULIN_NAME } from '../data/mockData';
import { Card } from './ui';

interface BolusCalculatorProps {
  glucose: GlucoseLog[];
  insulin: InsulinDose[];
  settings: UserSettings;
  /** Carbs pre-filled from a logged meal (grams). */
  suggestedCarbsG?: number;
  onLogDose: (dose: InsulinDose) => void;
}

export default function BolusCalculator({
  glucose,
  insulin,
  settings,
  suggestedCarbsG,
  onLogDose,
}: BolusCalculatorProps) {
  const { unit, targetBgMmol, icr, isfMmol, insulinDurationHours, doseStep, maxBolusUnits } = settings;
  const latest = useMemo(() => latestReading(glucose), [glucose]);
  const range = validInputRange(unit);

  const [carbsText, setCarbsText] = useState<string>(suggestedCarbsG ? String(suggestedCarbsG) : '');
  const [bgText, setBgText] = useState<string>(latest ? formatGlucose(latest.valueMmol, unit) : '');
  const [bgUnit, setBgUnit] = useState(unit);
  const [confirmedHigh, setConfirmedHigh] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);

  // Re-express the typed BG when the global unit toggles so the number stays the same physiological value.
  if (bgUnit !== unit) {
    const typed = Number(bgText);
    if (bgText !== '' && Number.isFinite(typed)) {
      const mmol = fromDisplayValue(typed, bgUnit);
      setBgText(formatGlucose(mmol, unit));
    }
    setBgUnit(unit);
  }

  const bgValue = bgText === '' ? NaN : Number(bgText);
  const bgValid = Number.isFinite(bgValue) && bgValue >= range.min && bgValue <= range.max;
  const bgMmol = bgValid ? fromDisplayValue(bgValue, unit) : NaN;

  const carbs = carbsText === '' ? 0 : Number(carbsText);
  const carbsValid = Number.isFinite(carbs) && carbs >= 0 && carbs <= 500;

  // Recomputed whenever the insulin log changes (e.g. right after a dose is saved).
  const iob = useMemo(
    () => calculateIob(insulin, insulinDurationHours, new Date()),
    [insulin, insulinDurationHours],
  );

  const result = useMemo(() => {
    if (!bgValid || !carbsValid) return null;
    return calculateBolus({
      carbsG: carbs,
      currentBgMmol: bgMmol,
      targetBgMmol,
      icr,
      isfMmol,
      iobUnits: iob,
      doseStep,
      maxBolusUnits,
    });
  }, [bgValid, carbsValid, carbs, bgMmol, targetBgMmol, icr, isfMmol, iob, doseStep, maxBolusUnits]);

  const isHypo = bgValid && bgMmol < HYPO_THRESHOLD_MMOL;
  const overLimit = !!result && !result.blocked && result.recommendedUnits > maxBolusUnits;
  const canLog = !!result && !result.blocked && result.recommendedUnits > 0 && (!overLimit || confirmedHigh);

  const useLatest = (): void => {
    if (latest) {
      setBgText(formatGlucose(latest.valueMmol, unit));
      setLogged(null);
    }
  };

  const handleLog = (): void => {
    if (!result || !canLog) return;
    const dose: InsulinDose = {
      id: makeId('ins'),
      timestamp: new Date().toISOString(),
      units: result.recommendedUnits,
      type: result.correctionBolus > 0 && carbs === 0 ? 'correction' : 'bolus',
      insulinName: RAPID_INSULIN_NAME,
      note: `Calculator: ${carbs} g carbs, BG ${formatGlucose(bgMmol, unit)} ${unit}`,
    };
    onLogDose(dose);
    setLogged(`${dose.units} units logged. It now counts as active insulin.`);
    setConfirmedHigh(false);
    setCarbsText('');
  };

  return (
    <Card
      id="bolus"
      title="Bolus calculator"
      subtitle="Food dose + correction dose − active insulin"
      icon={<Calculator className="h-4 w-4" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bolus-carbs" className="field-label">
            Carbohydrates to eat (g)
          </label>
          <input
            id="bolus-carbs"
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            step={1}
            className="field-input"
            value={carbsText}
            onChange={(e) => {
              setCarbsText(e.target.value);
              setLogged(null);
            }}
            placeholder="e.g. 60"
          />
          {!carbsValid && <p className="mt-1 text-sm text-rose-700">Enter carbs between 0 and 500 g.</p>}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="bolus-bg" className="field-label">
              Current glucose ({unit})
            </label>
            {latest && (
              <button
                type="button"
                onClick={useLatest}
                className="mb-1 text-xs font-semibold text-teal-700 underline-offset-2 hover:underline"
              >
                Use latest ({formatGlucose(latest.valueMmol, unit)}, {timeAgo(latest.timestamp)})
              </button>
            )}
          </div>
          <input
            id="bolus-bg"
            type="number"
            inputMode="decimal"
            min={range.min}
            max={range.max}
            step={range.step}
            className="field-input"
            value={bgText}
            onChange={(e) => {
              setBgText(e.target.value);
              setLogged(null);
            }}
            placeholder={unit === 'mmol/L' ? 'e.g. 8.4' : 'e.g. 150'}
            aria-invalid={bgText !== '' && !bgValid}
          />
          {bgText !== '' && !bgValid && (
            <p className="mt-1 text-sm text-rose-700">
              Enter a value between {range.min} and {range.max} {unit}.
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Carb ratio</dt>
          <dd className="font-semibold text-slate-800">1 U : {icr} g</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sensitivity</dt>
          <dd className="font-semibold text-slate-800">
            1 U : {formatGlucose(isfMmol, unit)} {unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Target</dt>
          <dd className="font-semibold text-slate-800">
            {formatGlucose(targetBgMmol, unit)} {unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Active insulin (IOB)</dt>
          <dd className="font-semibold text-slate-800">{iob.toFixed(1)} U</dd>
        </div>
      </dl>

      {/* Hypoglycemia guardrail */}
      {isHypo && (
        <div role="alert" className="mt-4 rounded-xl border-2 border-rose-400 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-700" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-rose-900">Low glucose: do not take insulin</h3>
              <p className="mt-1 text-sm text-rose-900">
                {formatGlucose(bgMmol, unit)} {unit} is below {formatGlucose(HYPO_THRESHOLD_MMOL, unit)} {unit}. Dosing is
                blocked until you treat the low.
              </p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-rose-950">
                {HYPO_PROTOCOL.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !result.blocked && (
        <div className="mt-4" aria-live="polite">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Suggested dose</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums text-teal-900">{result.recommendedUnits}</span>
              <span className="text-lg font-semibold text-teal-800">units</span>
            </p>
            <dl className="mt-3 space-y-1 text-sm text-teal-950">
              <div className="flex justify-between gap-4">
                <dt>
                  Food ({carbs} g ÷ {icr})
                </dt>
                <dd className="font-semibold tabular-nums">+ {result.foodBolus.toFixed(2)} U</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>
                  Correction (({formatGlucose(bgMmol, unit)} − {formatGlucose(targetBgMmol, unit)}) ÷{' '}
                  {formatGlucose(isfMmol, unit)})
                </dt>
                <dd className="font-semibold tabular-nums">
                  {result.correctionBolus >= 0 ? '+' : '−'} {Math.abs(result.correctionBolus).toFixed(2)} U
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Active insulin</dt>
                <dd className="font-semibold tabular-nums">− {result.iobDeducted.toFixed(2)} U</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-teal-200 pt-1">
                <dt>Total, rounded to {doseStep} U</dt>
                <dd className="font-bold tabular-nums">{result.recommendedUnits} U</dd>
              </div>
            </dl>
          </div>

          {result.warnings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          {overLimit && (
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-400 text-teal-700 focus:ring-teal-600"
                checked={confirmedHigh}
                onChange={(e) => setConfirmedHigh(e.target.checked)}
              />
              <span>I have double-checked this large dose with my care plan.</span>
            </label>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={!canLog} onClick={handleLog}>
              <Syringe className="h-4 w-4" aria-hidden="true" />
              Log {result.recommendedUnits} U as taken
            </button>
            <p className="text-xs text-slate-500">Logging records the dose only. It does not deliver insulin.</p>
          </div>
        </div>
      )}

      {!result && !isHypo && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Enter your current glucose and the carbohydrates you plan to eat to see a suggested dose.
        </p>
      )}

      {logged && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {logged}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Based on your saved ratios (ICR {icr} g/U, ISF {round(isfMmol, 1)} mmol/L per U). Always confirm doses with your
        diabetes care team. This tool does not replace medical advice.
      </p>
    </Card>
  );
}
