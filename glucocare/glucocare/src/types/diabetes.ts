/**
 * Core domain types for GlucoCare.
 *
 * All glucose values are STORED in mmol/L (the canonical unit). The UI converts
 * to mg/dL on display only, so toggling units can never corrupt stored data.
 * All timestamps are ISO-8601 strings in UTC; local dates are derived on display.
 */

export type GlucoseUnit = 'mmol/L' | 'mg/dL';
export type UserRole = 'patient' | 'caregiver' | 'doctor';

export type GlucoseSource = 'cgm' | 'fingerstick';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type InsulinType = 'bolus' | 'correction' | 'basal';
export type ExerciseIntensity = 'light' | 'moderate' | 'vigorous';
export type MedicationKind = 'basal-insulin' | 'oral' | 'other';
export type GlycemicIndexBand = 'low' | 'medium' | 'high';
export type AlertLevel = 'urgent-low' | 'low' | 'high' | 'urgent-high';

export interface GlucoseLog {
  id: string;
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
  /** Glucose in mmol/L (canonical unit). */
  valueMmol: number;
  source: GlucoseSource;
  note?: string;
}

export interface MealItem {
  foodId: string;
  name: string;
  /** Number of servings consumed (e.g. 1.5). */
  servings: number;
  servingLabel: string;
  carbsG: number;
}

export interface MealLog {
  id: string;
  timestamp: string;
  mealType: MealType;
  /** Human-readable summary, e.g. "Ugali + Sukuma wiki". */
  name: string;
  items: MealItem[];
  /** Total carbohydrate in grams. */
  carbsG: number;
}

export interface InsulinDose {
  id: string;
  timestamp: string;
  units: number;
  type: InsulinType;
  insulinName: string;
  note?: string;
}

export interface ExerciseLog {
  id: string;
  timestamp: string;
  activity: string;
  durationMin: number;
  intensity: ExerciseIntensity;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  kind: MedicationKind;
  /** Scheduled time of day in 24h "HH:mm" (local time). */
  scheduledTime: string;
  instructions?: string;
}

/** A record that a medication was taken on a given local calendar date. */
export interface MedicationIntake {
  id: string;
  medicationId: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  /** ISO timestamp of when it was ticked off. */
  takenAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface UserSettings {
  patientName: string;
  caregiverName: string;
  unit: GlucoseUnit;
  role: UserRole;
  /** Lower bound of target range, mmol/L. */
  targetLowMmol: number;
  /** Upper bound of target range, mmol/L. */
  targetHighMmol: number;
  /** Single target used by the bolus calculator, mmol/L. */
  targetBgMmol: number;
  /** Insulin-to-carb ratio: grams of carbohydrate covered by 1 unit. */
  icr: number;
  /** Insulin sensitivity factor: mmol/L lowered by 1 unit. */
  isfMmol: number;
  /** Duration of insulin action in hours (used for IOB decay). */
  insulinDurationHours: number;
  /** Bolus dose rounding step in units (0.5 for half-unit pens, 1 for whole-unit pens). */
  doseStep: number;
  /** Warn when a recommended single dose exceeds this many units. */
  maxBolusUnits: number;
  emergencyContacts: EmergencyContact[];
}

export interface FoodItem {
  id: string;
  name: string;
  /** Local / alternative names used by the search box. */
  aliases: string[];
  category: 'staple' | 'vegetable' | 'protein' | 'fruit' | 'dairy' | 'snack' | 'drink' | 'legume';
  region: 'east-african' | 'common';
  servingLabel: string;
  servingGrams: number;
  /** Available (net) carbohydrate per serving, grams. */
  carbsPerServingG: number;
  /** Glycemic index (0-100), approximate. */
  gi: number;
  giBand: GlycemicIndexBand;
}

export interface DiabetesState {
  glucose: GlucoseLog[];
  meals: MealLog[];
  insulin: InsulinDose[];
  exercise: ExerciseLog[];
  medications: Medication[];
  medicationIntakes: MedicationIntake[];
  settings: UserSettings;
}

/** Derived: one contiguous out-of-range episode. */
export interface AlertEvent {
  id: string;
  level: AlertLevel;
  start: string;
  end: string;
  durationMin: number;
  /** Lowest value for low episodes, highest for high episodes (mmol/L). */
  extremeMmol: number;
}

export interface TimeInRange {
  veryLow: number;
  low: number;
  inRange: number;
  high: number;
  veryHigh: number;
  readings: number;
}

export interface BolusInput {
  carbsG: number;
  currentBgMmol: number;
  targetBgMmol: number;
  icr: number;
  isfMmol: number;
  iobUnits: number;
  doseStep: number;
  maxBolusUnits: number;
}

export interface BolusResult {
  foodBolus: number;
  correctionBolus: number;
  iobDeducted: number;
  /** Raw sum before clamping / rounding. */
  rawTotal: number;
  /** Final rounded recommendation (never negative). Always 0 when blocked. */
  recommendedUnits: number;
  /** True when dosing must not proceed (hypoglycemia). */
  blocked: boolean;
  warnings: string[];
}

export interface AgpBin {
  label: string;
  startHour: number;
  count: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  mean: number;
  percentInRange: number;
}
