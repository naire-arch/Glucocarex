import { Settings } from 'lucide-react';
import { useState } from 'react';
import type { UserSettings } from '../types/diabetes';
import { formatGlucose, fromDisplayValue, round, toDisplayValue } from '../utils/glucoseMath';
import { Card } from './ui';

interface SettingsPanelProps {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
}

function NumberField({ id, label, hint, value, min, max, step, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(String(value));
  }
  const n = Number(text);
  const valid = text !== '' && Number.isFinite(n) && n >= min && n <= max;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        className="field-input"
        value={text}
        aria-invalid={!valid}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v) && v >= min && v <= max) onCommit(v);
        }}
      />
      <p id={`${id}-hint`} className={`mt-1 text-xs ${valid ? 'text-slate-500' : 'text-rose-700'}`}>
        {valid ? hint : `Enter a value between ${min} and ${max}.`}
      </p>
    </div>
  );
}

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const { unit } = settings;
  const isMmol = unit === 'mmol/L';

  // Glucose-valued settings are edited in the display unit and stored in mmol/L.
  const glucoseField = (
    id: string,
    label: string,
    hint: string,
    valueMmol: number,
    key: 'targetBgMmol' | 'isfMmol' | 'targetLowMmol' | 'targetHighMmol',
    mmolBounds: [number, number],
  ) => (
    <NumberField
      id={id}
      label={`${label} (${unit})`}
      hint={hint}
      value={toDisplayValue(valueMmol, unit)}
      min={isMmol ? mmolBounds[0] : Math.round(mmolBounds[0] * 18)}
      max={isMmol ? mmolBounds[1] : Math.round(mmolBounds[1] * 18)}
      step={isMmol ? 0.1 : 1}
      onCommit={(v) => onChange({ [key]: round(fromDisplayValue(v, unit), 2) } as Partial<UserSettings>)}
    />
  );

  return (
    <Card
      id="settings"
      title="Dose settings"
      subtitle="Set these with your diabetes care team"
      icon={<Settings className="h-4 w-4" />}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField id="set-icr" label="Carb ratio (g per 1 U)" hint="Grams of carbs covered by 1 unit." value={settings.icr} min={1} max={150} step={0.5} onCommit={(v) => onChange({ icr: v })} />
        {glucoseField('set-isf', 'Sensitivity (drop per 1 U)', 'How far 1 unit lowers glucose.', settings.isfMmol, 'isfMmol', [0.2, 15])}
        {glucoseField('set-target', 'Target glucose', 'Used for correction doses.', settings.targetBgMmol, 'targetBgMmol', [4, 10])}
        {glucoseField('set-low', 'Range low', 'Lower edge of target range.', settings.targetLowMmol, 'targetLowMmol', [3, 6])}
        {glucoseField('set-high', 'Range high', 'Upper edge of target range.', settings.targetHighMmol, 'targetHighMmol', [7, 14])}
        <NumberField id="set-dia" label="Insulin duration (hours)" hint="How long a dose stays active." value={settings.insulinDurationHours} min={2} max={8} step={0.5} onCommit={(v) => onChange({ insulinDurationHours: v })} />
        <NumberField id="set-step" label="Dose step (units)" hint="0.5 for half-unit pens, 1 for whole-unit." value={settings.doseStep} min={0.1} max={1} step={0.1} onCommit={(v) => onChange({ doseStep: v })} />
        <NumberField id="set-max" label="Max single dose (units)" hint="Larger doses ask for confirmation." value={settings.maxBolusUnits} min={1} max={50} step={1} onCommit={(v) => onChange({ maxBolusUnits: v })} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Current target range: {formatGlucose(settings.targetLowMmol, unit)}–{formatGlucose(settings.targetHighMmol, unit)} {unit}.
      </p>
    </Card>
  );
}
