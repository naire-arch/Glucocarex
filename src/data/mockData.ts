import type {
  DiabetesState,
  ExerciseIntensity,
  ExerciseLog,
  GlucoseLog,
  InsulinDose,
  MealItem,
  MealLog,
  MealType,
  Medication,
  MedicationIntake,
  UserSettings,
} from '../types/diabetes';
import { toLocalDateKey } from '../utils/dateUtils';
import { roundToStep } from '../utils/glucoseMath';
import { getFoodById } from './foodDatabase';

/**
 * Deterministic, realistic demo telemetry: 14 days of CGM readings (every
 * 15 minutes) with meals, bolus/correction/basal insulin, exercise and
 * medication adherence. All people and contact numbers are fictional.
 */

export const RAPID_INSULIN_NAME = 'Insulin aspart (rapid-acting)';
export const BASAL_INSULIN_NAME = 'Insulin glargine (basal)';

export const DEFAULT_SETTINGS: UserSettings = {
  patientName: 'Amina Wanjiru',
  caregiverName: 'Joseph Wanjiru',
  unit: 'mmol/L',
  role: 'patient',
  targetLowMmol: 3.9,
  targetHighMmol: 10.0,
  targetBgMmol: 6.0,
  icr: 12,
  isfMmol: 2.5,
  insulinDurationHours: 4,
  doseStep: 0.5,
  maxBolusUnits: 12,
  emergencyContacts: [
    { id: 'ec-1', name: 'Joseph Wanjiru', relationship: 'Husband (primary caregiver)', phone: '+254700000001' },
    { id: 'ec-2', name: 'Dr. Achieng Otieno', relationship: 'Endocrinologist', phone: '+254700000002' },
    { id: 'ec-3', name: 'Emergency services', relationship: 'Ambulance / police', phone: '999' },
  ],
};

export const DEFAULT_MEDICATIONS: Medication[] = [
  {
    id: 'med-metformin-am',
    name: 'Metformin',
    dose: '500 mg tablet',
    kind: 'oral',
    scheduledTime: '08:00',
    instructions: 'Take with breakfast.',
  },
  {
    id: 'med-metformin-pm',
    name: 'Metformin',
    dose: '500 mg tablet',
    kind: 'oral',
    scheduledTime: '20:00',
    instructions: 'Take with dinner.',
  },
  {
    id: 'med-basal',
    name: BASAL_INSULIN_NAME,
    dose: '18 units',
    kind: 'basal-insulin',
    scheduledTime: '22:00',
    instructions: 'Inject at the same time every night.',
  },
];

const BASAL_UNITS = 18;
const BASELINE_MMOL = 7.1;
const INSULIN_SCALE = 0.7;
const DAYS = 14;
const STEP_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Seeded random helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Meal templates built from the food database: [foodId, servings]
// ---------------------------------------------------------------------------

type Template = Array<[string, number]>;

const MEAL_TEMPLATES: Record<MealType, Template[]> = {
  breakfast: [
    [['chai', 1], ['mandazi', 2]],
    [['uji', 1], ['mayai', 2], ['ndizi-mbivu', 1]],
    [['chapati', 1], ['mayai', 1], ['chai', 1]],
    [['bread-brown', 2], ['mayai', 1], ['avocado', 1], ['chai', 1]],
    [['oats', 1], ['milk', 1]],
  ],
  lunch: [
    [['ugali', 1], ['sukuma-wiki', 1], ['nyama-choma', 1]],
    [['githeri', 1.5], ['kachumbari', 1]],
    [['wali', 1], ['maharagwe', 1], ['kachumbari', 1]],
    [['chapati', 2], ['ndengu', 1], ['sukuma-wiki', 1]],
    [['pilau', 1], ['kachumbari', 1], ['kuku', 1]],
    [['matoke', 1], ['samaki', 1], ['mchicha', 1]],
  ],
  dinner: [
    [['ugali', 1], ['sukuma-wiki', 1], ['samaki', 1]],
    [['chapati', 2], ['maharagwe', 1]],
    [['viazi-vitamu', 1], ['kuku', 1], ['kabichi', 1]],
    [['wali', 1], ['ndengu', 1], ['mchicha', 1]],
    [['mukimo', 1], ['nyama-choma', 1]],
  ],
  snack: [
    [['apple', 1]],
    [['groundnuts', 1], ['chai', 1]],
    [['ndizi-mbivu', 1]],
    [['samosa', 1]],
    [['maziwa-lala', 1]],
  ],
};

function shortName(name: string): string {
  const idx = name.indexOf(' (');
  return idx === -1 ? name : name.slice(0, idx);
}

function buildMealItems(template: Template): MealItem[] {
  const items: MealItem[] = [];
  for (const [foodId, servings] of template) {
    const food = getFoodById(foodId);
    if (!food) continue;
    items.push({
      foodId,
      name: shortName(food.name),
      servings,
      servingLabel: food.servingLabel,
      carbsG: Math.round(food.carbsPerServingG * servings * 10) / 10,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Physiological response curves (minutes since event)
// ---------------------------------------------------------------------------

function bump(dtMin: number, peakMin: number): number {
  if (dtMin < 0) return 0;
  const x = dtMin / peakMin;
  return x * Math.exp(1 - x);
}

interface CarbEvent {
  t: number;
  carbs: number;
}
interface InsulinEvent {
  t: number;
  units: number;
  eff: number;
}
interface ExerciseEvent {
  t: number;
  minutes: number;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateMockState(now: Date = new Date(), seed = 20261118): DiabetesState {
  const rand = mulberry32(seed);
  const between = (a: number, b: number): number => a + rand() * (b - a);
  const chance = (p: number): boolean => rand() < p;
  const gauss = (): number => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const settings = DEFAULT_SETTINGS;
  const nowMs = now.getTime();
  const lastStep = Math.floor(nowMs / STEP_MS) * STEP_MS;
  const steps = DAYS * 96;
  const firstStep = lastStep - (steps - 1) * STEP_MS;

  // Smooth, auto-correlated sensor / physiology noise.
  const noise: number[] = [];
  let n = 0;
  for (let i = 0; i < steps; i += 1) {
    n = 0.92 * n + gauss() * 0.18;
    noise.push(n);
  }

  const carbEvents: CarbEvent[] = [];
  const insulinEvents: InsulinEvent[] = [];
  const exerciseEvents: ExerciseEvent[] = [];

  const meals: MealLog[] = [];
  const insulin: InsulinDose[] = [];
  const exercise: ExerciseLog[] = [];
  const intakes: MedicationIntake[] = [];

  const hourOf = (ms: number): number => {
    const d = new Date(ms);
    return d.getHours() + d.getMinutes() / 60;
  };

  const deterministic = (tMs: number): number => {
    const h = hourOf(tMs);
    let g = BASELINE_MMOL + 0.9 * Math.exp(-(((h - 6) / 1.6) ** 2)) - 0.3 * Math.exp(-(((h - 15) / 2) ** 2));
    for (const c of carbEvents) {
      g += 0.21 * c.carbs * bump((tMs - c.t) / 60000, 70);
    }
    for (const i of insulinEvents) {
      g -= i.units * settings.isfMmol * i.eff * INSULIN_SCALE * bump((tMs - i.t) / 60000, 95);
    }
    for (const e of exerciseEvents) {
      g -= e.minutes * 0.035 * bump((tMs - e.t) / 60000, 90);
    }
    return g;
  };

  const noiseAt = (tMs: number): number => {
    const idx = Math.round((tMs - firstStep) / STEP_MS);
    return noise[Math.min(steps - 1, Math.max(0, idx))] ?? 0;
  };

  let mealCounter = 0;
  let doseCounter = 0;
  let exerciseCounter = 0;

  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1));

  for (let d = 0; d < DAYS; d += 1) {
    const y = startDay.getFullYear();
    const m = startDay.getMonth();
    const day = startDay.getDate() + d;
    const at = (hour: number): number => new Date(y, m, day, Math.floor(hour), Math.round((hour % 1) * 60)).getTime();

    const plan: Array<{ type: MealType; t: number }> = [
      { type: 'breakfast', t: at(between(7.0, 8.2)) },
      { type: 'lunch', t: at(between(12.5, 14.0)) },
    ];
    if (chance(0.6)) plan.push({ type: 'snack', t: at(between(16.0, 16.75)) });
    plan.push({ type: 'dinner', t: at(between(19.0, 20.5)) });

    // Exercise on roughly one day in four, in the late afternoon.
    if (chance(0.28)) {
      const t = at(between(17.0, 17.75));
      if (t <= nowMs) {
        const minutes = Math.round(between(25, 50) / 5) * 5;
        const intensity: ExerciseIntensity = minutes >= 40 ? 'moderate' : 'light';
        exerciseEvents.push({ t, minutes });
        exerciseCounter += 1;
        exercise.push({
          id: `ex-${exerciseCounter}`,
          timestamp: new Date(t).toISOString(),
          activity: chance(0.5) ? 'Brisk walk' : 'Cycling',
          durationMin: minutes,
          intensity,
        });
      }
    }

    for (const entry of plan) {
      if (entry.t > nowMs) continue;
      const templates = MEAL_TEMPLATES[entry.type];
      const template = templates[Math.floor(rand() * templates.length)] ?? templates[0];
      const items = buildMealItems(template);
      const carbs = Math.round(items.reduce((s, i) => s + i.carbsG, 0));
      mealCounter += 1;
      meals.push({
        id: `meal-${mealCounter}`,
        timestamp: new Date(entry.t).toISOString(),
        mealType: entry.type,
        name: items.map((i) => i.name).join(' + '),
        items,
        carbsG: carbs,
      });

      // Pre-meal glucose decides whether a correction dose is needed.
      const preMeal = deterministic(entry.t) + noiseAt(entry.t);

      carbEvents.push({ t: entry.t, carbs });

      const skipsBolus = entry.type === 'snack' ? carbs <= 15 : chance(0.09);
      const overdoses = !skipsBolus && chance(0.04);
      const eff = overdoses ? between(1.4, 1.6) : between(0.82, 1.12);

      if (!skipsBolus) {
        const units = Math.max(0.5, roundToStep(carbs / settings.icr, settings.doseStep));
        doseCounter += 1;
        insulin.push({
          id: `ins-${doseCounter}`,
          timestamp: new Date(entry.t).toISOString(),
          units,
          type: 'bolus',
          insulinName: RAPID_INSULIN_NAME,
          note: `${carbs} g carbs`,
        });
        insulinEvents.push({ t: entry.t, units, eff });
      }

      if (preMeal > settings.targetHighMmol && !skipsBolus) {
        const corr = Math.min(4, roundToStep((preMeal - settings.targetBgMmol) / settings.isfMmol, settings.doseStep));
        if (corr > 0) {
          doseCounter += 1;
          insulin.push({
            id: `ins-${doseCounter}`,
            timestamp: new Date(entry.t).toISOString(),
            units: corr,
            type: 'correction',
            insulinName: RAPID_INSULIN_NAME,
            note: `Correction for ${preMeal.toFixed(1)} mmol/L`,
          });
          insulinEvents.push({ t: entry.t, units: corr, eff });
        }
      }
    }

    // Medication intakes and basal insulin log.
    const dateKey = toLocalDateKey(new Date(y, m, day));
    for (const med of DEFAULT_MEDICATIONS) {
      const [hh, mm] = med.scheduledTime.split(':').map(Number);
      const due = new Date(y, m, day, hh, mm).getTime();
      if (due > nowMs) continue;
      // Slightly lower adherence on a couple of mid-period days to look realistic.
      const adherenceChance = d === 4 || d === 9 ? 0.5 : 0.93;
      if (!chance(adherenceChance)) continue;
      const takenAtMs = due + Math.round(between(-10, 40)) * 60000;
      intakes.push({
        id: `intake-${med.id}-${dateKey}`,
        medicationId: med.id,
        date: dateKey,
        takenAt: new Date(Math.min(takenAtMs, nowMs)).toISOString(),
      });
      if (med.kind === 'basal-insulin') {
        doseCounter += 1;
        insulin.push({
          id: `ins-${doseCounter}`,
          timestamp: new Date(due).toISOString(),
          units: BASAL_UNITS,
          type: 'basal',
          insulinName: BASAL_INSULIN_NAME,
        });
      }
    }
  }

  // Build the CGM trace. Two short sensor gaps keep the data honest.
  const gapStarts = [Math.floor(steps * 0.38), Math.floor(steps * 0.71)];
  const gapLengths = [8, 14];
  const glucose: GlucoseLog[] = [];
  for (let i = 0; i < steps; i += 1) {
    const inGap = gapStarts.some((s, k) => i >= s && i < s + gapLengths[k]);
    if (inGap) continue;
    const t = firstStep + i * STEP_MS;
    const raw = deterministic(t) + noise[i];
    const value = Math.min(22, Math.max(2.2, raw));
    glucose.push({
      id: `cgm-${i}`,
      timestamp: new Date(t).toISOString(),
      valueMmol: Math.round(value * 10) / 10,
      source: 'cgm',
    });
  }

  // Fingerstick checks before the first meal of each of the last 4 days.
  const firstMeals = new Map<string, MealLog>();
  for (const meal of meals) {
    const key = toLocalDateKey(meal.timestamp);
    const existing = firstMeals.get(key);
    if (!existing && meal.mealType === 'breakfast') firstMeals.set(key, meal);
  }
  let fsCounter = 0;
  for (const meal of Array.from(firstMeals.values()).slice(-4)) {
    const t = new Date(meal.timestamp).getTime() - 5 * 60000;
    const value = Math.min(22, Math.max(2.2, deterministic(t) + noiseAt(t) + gauss() * 0.2));
    fsCounter += 1;
    glucose.push({
      id: `fs-${fsCounter}`,
      timestamp: new Date(t).toISOString(),
      valueMmol: Math.round(value * 10) / 10,
      source: 'fingerstick',
      note: 'Pre-breakfast check',
    });
  }

  glucose.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    glucose,
    meals,
    insulin,
    exercise,
    medications: DEFAULT_MEDICATIONS,
    medicationIntakes: intakes,
    settings,
  };
}

/** A clean state with default settings and medications but no logged data. */
export function createEmptyState(): DiabetesState {
  return {
    glucose: [],
    meals: [],
    insulin: [],
    exercise: [],
    medications: DEFAULT_MEDICATIONS,
    medicationIntakes: [],
    settings: DEFAULT_SETTINGS,
  };
}
