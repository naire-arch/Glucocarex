import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DiabetesState,
  ExerciseLog,
  GlucoseLog,
  GlucoseUnit,
  InsulinDose,
  MealLog,
  MedicationIntake,
  UserRole,
  UserSettings,
} from '../types/diabetes';
import { createEmptyState, DEFAULT_SETTINGS, generateMockState } from '../data/mockData';
import { toLocalDateKey } from '../utils/dateUtils';
import { sortByTime } from '../utils/glucoseMath';

/**
 * Persistence layer.
 *
 * State lives in React and is mirrored to localStorage. To plug in Supabase or
 * Firebase later, replace `loadState` / `saveState` (and the optional
 * `StorageAdapter` below) with async calls; components only talk to the hook.
 */

const STORAGE_KEY = 'glucocare.state.v1';

export interface StorageAdapter {
  load: () => DiabetesState | null;
  save: (state: DiabetesState) => void;
  clear: () => void;
}

function isStateShape(value: unknown): value is DiabetesState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.glucose) &&
    Array.isArray(v.meals) &&
    Array.isArray(v.insulin) &&
    Array.isArray(v.exercise) &&
    Array.isArray(v.medications) &&
    Array.isArray(v.medicationIntakes) &&
    typeof v.settings === 'object' &&
    v.settings !== null
  );
}

export const localStorageAdapter: StorageAdapter = {
  load: () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isStateShape(parsed)) return null;
      // Merge so settings added in newer versions get sensible defaults.
      return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
    } catch {
      return null;
    }
  },
  save: (state) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage may be full or disabled (private mode). The app keeps working in memory.
    }
  },
  clear: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};

export interface DiabetesStore {
  state: DiabetesState;
  /** Latest-first helpers are derived by consumers; arrays here are chronological. */
  addGlucose: (log: GlucoseLog) => void;
  addMeal: (meal: MealLog) => void;
  addInsulin: (dose: InsulinDose) => void;
  addExercise: (log: ExerciseLog) => void;
  toggleMedication: (medicationId: string, date?: string) => void;
  setUnit: (unit: GlucoseUnit) => void;
  setRole: (role: UserRole) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  loadDemoData: () => void;
  clearAllData: () => void;
}

export function useDiabetesStore(adapter: StorageAdapter = localStorageAdapter): DiabetesStore {
  const [state, setState] = useState<DiabetesState>(() => adapter.load() ?? generateMockState());

  // Persist every change.
  useEffect(() => {
    adapter.save(state);
  }, [state, adapter]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== STORAGE_KEY) return;
      const next = adapter.load();
      if (next) setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [adapter]);

  const addGlucose = useCallback((log: GlucoseLog) => {
    setState((s) => ({ ...s, glucose: sortByTime([...s.glucose, log]) }));
  }, []);

  const addMeal = useCallback((meal: MealLog) => {
    setState((s) => ({ ...s, meals: sortByTime([...s.meals, meal]) }));
  }, []);

  const addInsulin = useCallback((dose: InsulinDose) => {
    setState((s) => ({ ...s, insulin: sortByTime([...s.insulin, dose]) }));
  }, []);

  const addExercise = useCallback((log: ExerciseLog) => {
    setState((s) => ({ ...s, exercise: sortByTime([...s.exercise, log]) }));
  }, []);

  const toggleMedication = useCallback((medicationId: string, date?: string) => {
    const dateKey = date ?? toLocalDateKey(new Date());
    setState((s) => {
      const existing = s.medicationIntakes.find(
        (i) => i.medicationId === medicationId && i.date === dateKey,
      );
      if (existing) {
        return {
          ...s,
          medicationIntakes: s.medicationIntakes.filter((i) => i.id !== existing.id),
        };
      }
      const intake: MedicationIntake = {
        id: `intake-${medicationId}-${dateKey}`,
        medicationId,
        date: dateKey,
        takenAt: new Date().toISOString(),
      };
      return { ...s, medicationIntakes: [...s.medicationIntakes, intake] };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const setUnit = useCallback(
    (unit: GlucoseUnit) => updateSettings({ unit }),
    [updateSettings],
  );

  const setRole = useCallback(
    (role: UserRole) => updateSettings({ role }),
    [updateSettings],
  );

  const loadDemoData = useCallback(() => {
    setState((s) => ({
      ...generateMockState(),
      settings: { ...DEFAULT_SETTINGS, unit: s.settings.unit, role: s.settings.role },
    }));
  }, []);

  const clearAllData = useCallback(() => {
    setState((s) => ({
      ...createEmptyState(),
      settings: { ...s.settings },
    }));
  }, []);

  return useMemo(
    () => ({
      state,
      addGlucose,
      addMeal,
      addInsulin,
      addExercise,
      toggleMedication,
      setUnit,
      setRole,
      updateSettings,
      loadDemoData,
      clearAllData,
    }),
    [
      state,
      addGlucose,
      addMeal,
      addInsulin,
      addExercise,
      toggleMedication,
      setUnit,
      setRole,
      updateSettings,
      loadDemoData,
      clearAllData,
    ],
  );
}
