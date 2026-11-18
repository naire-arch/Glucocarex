import { Activity, Droplet, Search, Syringe, Trash2, Utensils, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  ExerciseIntensity,
  ExerciseLog,
  FoodItem,
  GlucoseLog,
  InsulinDose,
  InsulinType,
  MealItem,
  MealLog,
  MealType,
  UserSettings,
} from '../types/diabetes';
import { getFoodById, searchFoods } from '../data/foodDatabase';
import { BASAL_INSULIN_NAME, RAPID_INSULIN_NAME } from '../data/mockData';
import { fromDisplayValue, validInputRange } from '../utils/glucoseMath';
import { fromDateTimeLocalValue, makeId, toDateTimeLocalValue } from '../utils/dateUtils';
import { Pill } from './ui';

export type LogTab = 'glucose' | 'meal' | 'insulin' | 'exercise';

interface QuickLogModalProps {
  open: boolean;
  initialTab?: LogTab;
  settings: UserSettings;
  onClose: () => void;
  onAddGlucose: (log: GlucoseLog) => void;
  onAddMeal: (meal: MealLog) => void;
  onAddInsulin: (dose: InsulinDose) => void;
  onAddExercise: (log: ExerciseLog) => void;
  /** Called after a meal is saved so the bolus calculator can pre-fill carbs. */
  onMealLogged?: (carbsG: number) => void;
}

const TABS: Array<{ key: LogTab; label: string; Icon: typeof Droplet }> = [
  { key: 'glucose', label: 'Glucose', Icon: Droplet },
  { key: 'meal', label: 'Meal', Icon: Utensils },
  { key: 'insulin', label: 'Insulin', Icon: Syringe },
  { key: 'exercise', label: 'Exercise', Icon: Activity },
];

const GI_STYLE: Record<FoodItem['giBand'], string> = {
  low: 'bg-emerald-100 text-emerald-900',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-rose-100 text-rose-900',
};

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

export default function QuickLogModal(props: QuickLogModalProps) {
  const { open, initialTab = 'glucose', settings, onClose } = props;
  const [tab, setTab] = useState<LogTab>(initialTab);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // Escape to close, lock background scroll, and return focus on close.
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-900/60"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            Quick log
          </h2>
          <button type="button" onClick={onClose} className="btn-secondary !min-h-[40px] !px-2.5" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label="What would you like to log?" className="grid grid-cols-4 gap-1 border-b border-slate-200 bg-slate-50 p-2">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setTab(key)}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                tab === key ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'glucose' && <GlucoseForm settings={settings} onSave={props.onAddGlucose} onDone={onClose} />}
          {tab === 'meal' && <MealForm onSave={props.onAddMeal} onDone={onClose} onMealLogged={props.onMealLogged} />}
          {tab === 'insulin' && <InsulinForm onSave={props.onAddInsulin} onDone={onClose} />}
          {tab === 'exercise' && <ExerciseForm onSave={props.onAddExercise} onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function TimeField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        When
      </label>
      <input
        id={id}
        type="datetime-local"
        className="field-input"
        value={value}
        max={toDateTimeLocalValue(new Date())}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}

function SubmitRow({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={disabled}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Glucose
// ---------------------------------------------------------------------------

function GlucoseForm({
  settings,
  onSave,
  onDone,
}: {
  settings: UserSettings;
  onSave: (log: GlucoseLog) => void;
  onDone: () => void;
}) {
  const { unit } = settings;
  const range = validInputRange(unit);
  const [value, setValue] = useState('');
  const [time, setTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [note, setNote] = useState('');
  const num = Number(value);
  const valid = value !== '' && Number.isFinite(num) && num >= range.min && num <= range.max;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: makeId('bg'),
      timestamp: fromDateTimeLocalValue(time),
      valueMmol: Math.round(fromDisplayValue(num, unit) * 10) / 10,
      source: 'fingerstick',
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="log-bg" className="field-label">
          Glucose reading ({unit})
        </label>
        <input
          id="log-bg"
          type="number"
          inputMode="decimal"
          autoFocus
          min={range.min}
          max={range.max}
          step={range.step}
          className="field-input text-2xl font-semibold"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={unit === 'mmol/L' ? '5.6' : '100'}
          aria-invalid={value !== '' && !valid}
        />
        {value !== '' && !valid && (
          <p className="mt-1 text-sm text-rose-700">
            Enter a value between {range.min} and {range.max} {unit}.
          </p>
        )}
      </div>
      <TimeField id="log-bg-time" value={time} onChange={setTime} />
      <div>
        <label htmlFor="log-bg-note" className="field-label">
          Note (optional)
        </label>
        <input id="log-bg-note" type="text" className="field-input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. before lunch, felt shaky" />
      </div>
      <SubmitRow label="Save glucose" disabled={!valid} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Meal
// ---------------------------------------------------------------------------

function MealForm({
  onSave,
  onDone,
  onMealLogged,
}: {
  onSave: (meal: MealLog) => void;
  onDone: () => void;
  onMealLogged?: (carbsG: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [time, setTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [manualCarbs, setManualCarbs] = useState('');
  const results = useMemo(() => searchFoods(query, 8), [query]);
  const foodCarbs = items.reduce((s, i) => s + i.carbsG, 0);
  const manual = manualCarbs === '' ? 0 : Number(manualCarbs);
  const manualValid = Number.isFinite(manual) && manual >= 0 && manual <= 500;
  const total = Math.round((foodCarbs + (manualValid ? manual : 0)) * 10) / 10;
  const canSave = (items.length > 0 || manual > 0) && manualValid;

  const addFood = (food: FoodItem): void => {
    setItems((prev) => {
      const existing = prev.find((i) => i.foodId === food.id);
      if (existing) {
        return prev.map((i) =>
          i.foodId === food.id
            ? { ...i, servings: i.servings + 1, carbsG: Math.round(food.carbsPerServingG * (i.servings + 1) * 10) / 10 }
            : i,
        );
      }
      return [
        ...prev,
        {
          foodId: food.id,
          name: food.name.split(' (')[0],
          servings: 1,
          servingLabel: food.servingLabel,
          carbsG: food.carbsPerServingG,
        },
      ];
    });
  };

  const setServings = (foodId: string, servings: number): void => {
    const food = getFoodById(foodId);
    if (!food) return;
    if (servings <= 0) {
      setItems((prev) => prev.filter((i) => i.foodId !== foodId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.foodId === foodId ? { ...i, servings, carbsG: Math.round(food.carbsPerServingG * servings * 10) / 10 } : i,
      ),
    );
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSave) return;
    const allItems: MealItem[] = [...items];
    if (manual > 0) {
      allItems.push({ foodId: 'manual', name: 'Other carbs', servings: 1, servingLabel: 'manual entry', carbsG: manual });
    }
    onSave({
      id: makeId('meal'),
      timestamp: fromDateTimeLocalValue(time),
      mealType,
      name: allItems.map((i) => i.name).join(' + '),
      items: allItems,
      carbsG: total,
    });
    onMealLogged?.(Math.round(total));
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="food-search" className="field-label">
          Search foods (try ugali, chapati, githeri, mandazi)
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="food-search"
            type="search"
            className="field-input pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            autoComplete="off"
          />
        </div>
        <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200" aria-label="Food results">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No foods match “{query}”. Use manual carbs below.</li>}
          {results.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => addFood(food)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{food.name}</span>
                  <span className="block truncate text-xs text-slate-500">{food.servingLabel}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill className={GI_STYLE[food.giBand]}>GI {food.gi || '–'}</Pill>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">{food.carbsPerServingG} g</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Foods in this meal">
          {items.map((item) => (
            <li key={item.foodId} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.carbsG} g carbs</p>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor={`serv-${item.foodId}`}>
                  Servings of {item.name}
                </label>
                <input
                  id={`serv-${item.foodId}`}
                  type="number"
                  min={0.25}
                  step={0.25}
                  className="field-input !w-20 !py-1.5 text-center"
                  value={item.servings}
                  onChange={(e) => setServings(item.foodId, Number(e.target.value))}
                />
                <button type="button" className="btn-secondary !min-h-[40px] !px-2.5" aria-label={`Remove ${item.name}`} onClick={() => setServings(item.foodId, 0)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="meal-type" className="field-label">
            Meal
          </label>
          <select id="meal-type" className="field-input" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <div>
          <label htmlFor="manual-carbs" className="field-label">
            Extra carbs (g)
          </label>
          <input
            id="manual-carbs"
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            className="field-input"
            value={manualCarbs}
            onChange={(e) => setManualCarbs(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      <TimeField id="log-meal-time" value={time} onChange={setTime} />

      <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
        <span className="text-sm font-medium text-teal-900">Total carbohydrate</span>
        <span className="text-2xl font-bold tabular-nums text-teal-900">{total} g</span>
      </div>
      <SubmitRow label="Save meal" disabled={!canSave} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Insulin
// ---------------------------------------------------------------------------

function InsulinForm({ onSave, onDone }: { onSave: (dose: InsulinDose) => void; onDone: () => void }) {
  const [units, setUnits] = useState('');
  const [type, setType] = useState<InsulinType>('bolus');
  const [time, setTime] = useState(() => toDateTimeLocalValue(new Date()));
  const [note, setNote] = useState('');
  const num = Number(units);
  const valid = units !== '' && Number.isFinite(num) && num > 0 && num <= 100;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: makeId('ins'),
      timestamp: fromDateTimeLocalValue(time),
      units: num,
      type,
      insulinName: type === 'basal' ? BASAL_INSULIN_NAME : RAPID_INSULIN_NAME,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="field-label">Insulin type</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['bolus', 'correction', 'basal'] as const).map((t) => (
            <label
              key={t}
              className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-semibold capitalize ${
                type === t ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'
              } focus-within:ring-2 focus-within:ring-teal-600`}
            >
              <input type="radio" name="insulin-type" className="sr-only" checked={type === t} onChange={() => setType(t)} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="log-units" className="field-label">
          Dose (units)
        </label>
        <input
          id="log-units"
          type="number"
          inputMode="decimal"
          autoFocus
          min={0.5}
          max={100}
          step={0.5}
          className="field-input text-2xl font-semibold"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          placeholder="e.g. 4"
          aria-invalid={units !== '' && !valid}
        />
        {units !== '' && !valid && <p className="mt-1 text-sm text-rose-700">Enter a dose between 0.5 and 100 units.</p>}
      </div>
      <TimeField id="log-ins-time" value={time} onChange={setTime} />
      <div>
        <label htmlFor="log-ins-note" className="field-label">
          Note (optional)
        </label>
        <input id="log-ins-note" type="text" className="field-input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <SubmitRow label="Save insulin dose" disabled={!valid} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

function ExerciseForm({ onSave, onDone }: { onSave: (log: ExerciseLog) => void; onDone: () => void }) {
  const [activity, setActivity] = useState('Brisk walk');
  const [minutes, setMinutes] = useState('30');
  const [intensity, setIntensity] = useState<ExerciseIntensity>('moderate');
  const [time, setTime] = useState(() => toDateTimeLocalValue(new Date()));
  const num = Number(minutes);
  const valid = activity.trim() !== '' && Number.isFinite(num) && num > 0 && num <= 600;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: makeId('ex'),
      timestamp: fromDateTimeLocalValue(time),
      activity: activity.trim(),
      durationMin: Math.round(num),
      intensity,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="ex-activity" className="field-label">
          Activity
        </label>
        <input id="ex-activity" type="text" className="field-input" maxLength={60} value={activity} onChange={(e) => setActivity(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ex-minutes" className="field-label">
            Duration (min)
          </label>
          <input id="ex-minutes" type="number" inputMode="numeric" min={1} max={600} className="field-input" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ex-intensity" className="field-label">
            Intensity
          </label>
          <select id="ex-intensity" className="field-input" value={intensity} onChange={(e) => setIntensity(e.target.value as ExerciseIntensity)}>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="vigorous">Vigorous</option>
          </select>
        </div>
      </div>
      <TimeField id="log-ex-time" value={time} onChange={setTime} />
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Exercise can lower glucose for hours. Check your glucose before and after, and keep fast-acting carbs nearby.
      </p>
      <SubmitRow label="Save exercise" disabled={!valid} />
    </form>
  );
}
