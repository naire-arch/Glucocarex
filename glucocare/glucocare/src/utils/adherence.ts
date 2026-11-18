import type { DiabetesState, Medication, MedicationIntake } from '../types/diabetes';
import { lastNDateKeys, toLocalDateKey, toLocalTime } from './dateUtils';

export interface AdherenceSummary {
  due: number;
  taken: number;
  /** 0-100. Returns 100 when nothing was due. */
  percent: number;
  /** Consecutive fully-adherent days. */
  streakDays: number;
}

const intakeKey = (medicationId: string, date: string): string => `${medicationId}|${date}`;

export function buildIntakeSet(intakes: MedicationIntake[]): Set<string> {
  return new Set(intakes.map((i) => intakeKey(i.medicationId, i.date)));
}

export function isTaken(intakes: MedicationIntake[], medicationId: string, date: string): boolean {
  return intakes.some((i) => i.medicationId === medicationId && i.date === date);
}

/**
 * Medications that count toward adherence on a given date. Past days count
 * everything; today only counts doses whose scheduled time has passed
 * (or that were already taken early).
 */
export function dueMedications(
  medications: Medication[],
  dateKey: string,
  takenSet: Set<string>,
  now: Date,
): Medication[] {
  const todayKey = toLocalDateKey(now);
  if (dateKey > todayKey) return [];
  if (dateKey < todayKey) return medications;
  const nowTime = toLocalTime(now);
  return medications.filter(
    (m) => m.scheduledTime <= nowTime || takenSet.has(intakeKey(m.id, dateKey)),
  );
}

export function computeAdherence(
  state: Pick<DiabetesState, 'medications' | 'medicationIntakes'>,
  days: number,
  now: Date = new Date(),
): AdherenceSummary {
  const takenSet = buildIntakeSet(state.medicationIntakes);
  const keys = lastNDateKeys(days, now);
  let due = 0;
  let taken = 0;
  for (const key of keys) {
    const meds = dueMedications(state.medications, key, takenSet, now);
    due += meds.length;
    taken += meds.filter((m) => takenSet.has(intakeKey(m.id, key))).length;
  }
  return {
    due,
    taken,
    percent: due === 0 ? 100 : (taken / due) * 100,
    streakDays: computeStreak(state, now),
  };
}

/**
 * Consecutive days (ending today, or yesterday if today is not yet complete)
 * on which every scheduled medication was taken.
 */
export function computeStreak(
  state: Pick<DiabetesState, 'medications' | 'medicationIntakes'>,
  now: Date = new Date(),
  maxDays = 365,
): number {
  if (state.medications.length === 0) return 0;
  const takenSet = buildIntakeSet(state.medicationIntakes);
  const keys = lastNDateKeys(Math.min(maxDays, 60), now).reverse(); // newest first
  let streak = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const allTaken = state.medications.every((m) => takenSet.has(intakeKey(m.id, key)));
    if (allTaken) {
      streak += 1;
    } else if (i === 0) {
      // Today is still in progress; do not break the streak yet.
      continue;
    } else {
      break;
    }
  }
  return streak;
}
