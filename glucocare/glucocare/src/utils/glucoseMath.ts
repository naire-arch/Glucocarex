import type {
  AgpBin,
  AlertEvent,
  AlertLevel,
  BolusInput,
  BolusResult,
  GlucoseLog,
  GlucoseUnit,
  InsulinDose,
  TimeInRange,
} from '../types/diabetes';

/** 1 mmol/L of glucose = 18.0182 mg/dL. */
export const MMOL_TO_MGDL = 18.0182;

/** Clinical thresholds (mmol/L) from the international consensus on CGM metrics. */
export const HYPO_THRESHOLD_MMOL = 3.9; // 70 mg/dL, Level 1 hypoglycemia
export const SEVERE_HYPO_THRESHOLD_MMOL = 3.0; // 54 mg/dL, Level 2 hypoglycemia
export const HYPER_THRESHOLD_MMOL = 10.0; // 180 mg/dL
export const SEVERE_HYPER_THRESHOLD_MMOL = 13.9; // 250 mg/dL

/** CGM reading interval used for data-sufficiency maths (minutes). */
export const CGM_INTERVAL_MIN = 15;

// ---------------------------------------------------------------------------
// Unit conversion & formatting
// ---------------------------------------------------------------------------

export function mmolToMgdl(mmol: number): number {
  return mmol * MMOL_TO_MGDL;
}

export function mgdlToMmol(mgdl: number): number {
  return mgdl / MMOL_TO_MGDL;
}

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Converts a canonical mmol/L value to the display unit (rounded). */
export function toDisplayValue(valueMmol: number, unit: GlucoseUnit): number {
  return unit === 'mmol/L' ? round(valueMmol, 1) : Math.round(mmolToMgdl(valueMmol));
}

/** Converts a value typed in the display unit back to canonical mmol/L. */
export function fromDisplayValue(value: number, unit: GlucoseUnit): number {
  return unit === 'mmol/L' ? value : mgdlToMmol(value);
}

/** "5.6" for mmol/L, "101" for mg/dL. */
export function formatGlucose(valueMmol: number, unit: GlucoseUnit): string {
  return unit === 'mmol/L' ? valueMmol.toFixed(1) : String(Math.round(mmolToMgdl(valueMmol)));
}

export function formatGlucoseWithUnit(valueMmol: number, unit: GlucoseUnit): string {
  return `${formatGlucose(valueMmol, unit)} ${unit}`;
}

/** Acceptable manual-entry range in the display unit. */
export function validInputRange(unit: GlucoseUnit): { min: number; max: number; step: number } {
  return unit === 'mmol/L' ? { min: 1, max: 33.3, step: 0.1 } : { min: 20, max: 600, step: 1 };
}

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = average(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Coefficient of variation as a percentage (<= 36% is considered stable). */
export function coefficientOfVariation(values: number[]): number {
  const m = average(values);
  if (m === 0) return 0;
  return (standardDeviation(values) / m) * 100;
}

/** Linear-interpolated percentile (p in 0..100) of an unsorted array. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export function averageGlucoseMmol(logs: GlucoseLog[]): number {
  return average(logs.map((l) => l.valueMmol));
}

/**
 * Estimated HbA1c (%) from average glucose using the ADAG regression:
 * eA1c (%) = (average mg/dL + 46.7) / 28.7.
 */
export function estimateA1c(avgMmol: number): number {
  if (avgMmol <= 0) return 0;
  return (mmolToMgdl(avgMmol) + 46.7) / 28.7;
}

/** NGSP (%) -> IFCC (mmol/mol): (A1c% - 2.15) x 10.929. */
export function a1cPercentToMmolMol(a1cPercent: number): number {
  if (a1cPercent <= 0) return 0;
  return (a1cPercent - 2.15) * 10.929;
}

/** Glucose Management Indicator (%): 3.31 + 0.02392 x mean mg/dL. */
export function glucoseManagementIndicator(avgMmol: number): number {
  if (avgMmol <= 0) return 0;
  return 3.31 + 0.02392 * mmolToMgdl(avgMmol);
}

// ---------------------------------------------------------------------------
// Time in range & filtering
// ---------------------------------------------------------------------------

export function filterByDays<T extends { timestamp: string }>(
  items: T[],
  days: number,
  now: Date = new Date(),
): T[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return items.filter((i) => {
    const t = new Date(i.timestamp).getTime();
    return t >= cutoff && t <= now.getTime() + 60_000;
  });
}

export function sortByTime<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function latestReading(logs: GlucoseLog[]): GlucoseLog | undefined {
  let latest: GlucoseLog | undefined;
  for (const l of logs) {
    if (!latest || new Date(l.timestamp).getTime() > new Date(latest.timestamp).getTime()) {
      latest = l;
    }
  }
  return latest;
}

/**
 * Splits readings into five consensus bands. Percentages sum to ~100.
 * `low`/`high` are the user's target-range bounds (mmol/L).
 */
export function timeInRange(logs: GlucoseLog[], low: number, high: number): TimeInRange {
  const n = logs.length;
  if (n === 0) {
    return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0, readings: 0 };
  }
  let veryLow = 0;
  let lowC = 0;
  let inRange = 0;
  let highC = 0;
  let veryHigh = 0;
  for (const { valueMmol: v } of logs) {
    if (v < SEVERE_HYPO_THRESHOLD_MMOL) veryLow += 1;
    else if (v < low) lowC += 1;
    else if (v <= high) inRange += 1;
    else if (v <= SEVERE_HYPER_THRESHOLD_MMOL) highC += 1;
    else veryHigh += 1;
  }
  const pct = (c: number): number => (c / n) * 100;
  return {
    veryLow: pct(veryLow),
    low: pct(lowC),
    inRange: pct(inRange),
    high: pct(highC),
    veryHigh: pct(veryHigh),
    readings: n,
  };
}

/** % of expected CGM readings that are present for the period (>= 70% is sufficient). */
export function cgmActivePercent(logs: GlucoseLog[], days: number): number {
  const cgmCount = logs.filter((l) => l.source === 'cgm').length;
  const expected = (days * 24 * 60) / CGM_INTERVAL_MIN;
  return Math.min(100, (cgmCount / expected) * 100);
}

// ---------------------------------------------------------------------------
// Alerts (episode detection)
// ---------------------------------------------------------------------------

export function classifyGlucose(valueMmol: number, low: number, high: number): AlertLevel | null {
  if (valueMmol < SEVERE_HYPO_THRESHOLD_MMOL) return 'urgent-low';
  if (valueMmol < low) return 'low';
  if (valueMmol > SEVERE_HYPER_THRESHOLD_MMOL) return 'urgent-high';
  if (valueMmol > high) return 'high';
  return null;
}

/**
 * Collapses consecutive out-of-range readings of the same severity into
 * single episodes so a 3-hour high is one alert, not twelve.
 * Result is ordered newest first.
 */
export function buildAlertEvents(logs: GlucoseLog[], low: number, high: number): AlertEvent[] {
  const sorted = sortByTime(logs);
  const events: AlertEvent[] = [];
  let current: AlertEvent | null = null;

  const close = (): void => {
    if (current) {
      current.durationMin = Math.max(
        CGM_INTERVAL_MIN,
        Math.round((new Date(current.end).getTime() - new Date(current.start).getTime()) / 60000) +
          CGM_INTERVAL_MIN,
      );
      events.push(current);
      current = null;
    }
  };

  for (const log of sorted) {
    const level = classifyGlucose(log.valueMmol, low, high);
    if (level === null) {
      close();
      continue;
    }
    if (current && current.level === level) {
      current.end = log.timestamp;
      current.extremeMmol =
        level === 'low' || level === 'urgent-low'
          ? Math.min(current.extremeMmol, log.valueMmol)
          : Math.max(current.extremeMmol, log.valueMmol);
    } else {
      close();
      current = {
        id: `alert-${log.id}`,
        level,
        start: log.timestamp,
        end: log.timestamp,
        durationMin: CGM_INTERVAL_MIN,
        extremeMmol: log.valueMmol,
      };
    }
  }
  close();
  return events.reverse();
}

export interface EpisodeCounts {
  hypoEpisodes: number;
  severeHypoEpisodes: number;
  hyperEpisodes: number;
  severeHyperEpisodes: number;
}

export function countEpisodes(events: AlertEvent[]): EpisodeCounts {
  return {
    hypoEpisodes: events.filter((e) => e.level === 'low' || e.level === 'urgent-low').length,
    severeHypoEpisodes: events.filter((e) => e.level === 'urgent-low').length,
    hyperEpisodes: events.filter((e) => e.level === 'high' || e.level === 'urgent-high').length,
    severeHyperEpisodes: events.filter((e) => e.level === 'urgent-high').length,
  };
}

// ---------------------------------------------------------------------------
// Insulin on board & bolus calculator
// ---------------------------------------------------------------------------

/**
 * Active insulin (IOB) from rapid-acting doses using a linear decay over the
 * duration of insulin action. Basal insulin is excluded.
 */
export function calculateIob(
  doses: InsulinDose[],
  durationHours: number,
  now: Date = new Date(),
): number {
  if (durationHours <= 0) return 0;
  let iob = 0;
  for (const dose of doses) {
    if (dose.type === 'basal') continue;
    const elapsedH = (now.getTime() - new Date(dose.timestamp).getTime()) / 3_600_000;
    if (elapsedH < 0 || elapsedH >= durationHours) continue;
    iob += dose.units * (1 - elapsedH / durationHours);
  }
  return Math.max(0, round(iob, 2));
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Bolus = Food (carbs / ICR) + Correction ((BG - target) / ISF) - IOB.
 *
 * Safety rules:
 *  - BG below 3.9 mmol/L (70 mg/dL) blocks dosing entirely and returns the
 *    hypoglycemia protocol (15 g fast-acting carbohydrate, recheck in 15 min).
 *  - The result is never negative and is rounded to the pen's dose step.
 *  - Warnings are raised for large doses, high glucose (ketones), and IOB offsets.
 */
export function calculateBolus(input: BolusInput): BolusResult {
  const { carbsG, currentBgMmol, targetBgMmol, icr, isfMmol, iobUnits, doseStep, maxBolusUnits } =
    input;
  const warnings: string[] = [];

  if (currentBgMmol < HYPO_THRESHOLD_MMOL) {
    return {
      foodBolus: 0,
      correctionBolus: 0,
      iobDeducted: 0,
      rawTotal: 0,
      recommendedUnits: 0,
      blocked: true,
      warnings: [
        'Glucose is below 3.9 mmol/L (70 mg/dL). Do NOT take insulin now. Treat the low first.',
      ],
    };
  }

  if (icr <= 0 || isfMmol <= 0) {
    return {
      foodBolus: 0,
      correctionBolus: 0,
      iobDeducted: 0,
      rawTotal: 0,
      recommendedUnits: 0,
      blocked: true,
      warnings: ['Insulin-to-carb ratio and sensitivity factor must be greater than zero. Update your settings.'],
    };
  }

  const foodBolus = Math.max(0, carbsG) / icr;
  const correctionBolus = (currentBgMmol - targetBgMmol) / isfMmol;
  const iobDeducted = Math.max(0, iobUnits);
  const rawTotal = foodBolus + correctionBolus - iobDeducted;
  const clamped = Math.max(0, rawTotal);
  const recommendedUnits = round(roundToStep(clamped, doseStep), 2);

  if (rawTotal < 0) {
    warnings.push('Active insulin and a below-target reading cancel the dose, so the recommendation is 0 units.');
  }
  if (iobDeducted > 0) {
    warnings.push(`${round(iobDeducted, 1)} units of active insulin were deducted to avoid stacking doses.`);
  }
  if (currentBgMmol < targetBgMmol && correctionBolus < 0 && foodBolus > 0) {
    warnings.push('Your glucose is below target, so the food dose was reduced. Consider eating before dosing.');
  }
  if (recommendedUnits > maxBolusUnits) {
    warnings.push(
      `This dose is above your ${maxBolusUnits} unit safety limit. Re-check your numbers and confirm with your care team before injecting.`,
    );
  }
  if (currentBgMmol >= SEVERE_HYPER_THRESHOLD_MMOL) {
    warnings.push('Glucose is very high (13.9 mmol/L or above). Check ketones and follow your sick-day plan.');
  }
  if (carbsG > 150) {
    warnings.push('Carbohydrate amount looks unusually high. Please double-check the entry.');
  }

  return {
    foodBolus: round(foodBolus, 2),
    correctionBolus: round(correctionBolus, 2),
    iobDeducted: round(iobDeducted, 2),
    rawTotal: round(rawTotal, 2),
    recommendedUnits,
    blocked: false,
    warnings,
  };
}

/** Standard "rule of 15" hypoglycemia treatment steps. */
export const HYPO_PROTOCOL: readonly string[] = [
  'Take 15 g of fast-acting carbohydrate: 3 to 4 glucose tablets, 150 ml of juice or regular soda, or 1 tablespoon of sugar or honey.',
  'Wait 15 minutes, then recheck your glucose.',
  'If still below 3.9 mmol/L (70 mg/dL), repeat the 15 g treatment.',
  'Once above 3.9 mmol/L, eat a small snack if your next meal is more than an hour away.',
  'If you cannot swallow, are confused or lose consciousness, call emergency services immediately.',
];

// ---------------------------------------------------------------------------
// Ambulatory Glucose Profile (AGP) summary
// ---------------------------------------------------------------------------

/** Builds a table of glucose percentiles per time-of-day block (default 2 hours). */
export function buildAgpBins(
  logs: GlucoseLog[],
  low: number,
  high: number,
  blockHours = 2,
): AgpBin[] {
  const bins: AgpBin[] = [];
  const pad = (n: number): string => String(n).padStart(2, '0');
  for (let start = 0; start < 24; start += blockHours) {
    const end = start + blockHours;
    const values = logs
      .filter((l) => {
        const h = new Date(l.timestamp).getHours();
        return h >= start && h < end;
      })
      .map((l) => l.valueMmol);
    const inRangeCount = values.filter((v) => v >= low && v <= high).length;
    bins.push({
      label: `${pad(start)}:00-${pad(end % 24)}:00`,
      startHour: start,
      count: values.length,
      p10: percentile(values, 10),
      p25: percentile(values, 25),
      median: percentile(values, 50),
      p75: percentile(values, 75),
      p90: percentile(values, 90),
      mean: average(values),
      percentInRange: values.length ? (inRangeCount / values.length) * 100 : 0,
    });
  }
  return bins;
}
