import type { AgpBin, DiabetesState, GlucoseUnit, TimeInRange } from '../types/diabetes';
import { computeAdherence } from './adherence';
import { toLocalDateKey, toLocalTime } from './dateUtils';
import {
  a1cPercentToMmolMol,
  average,
  buildAgpBins,
  buildAlertEvents,
  cgmActivePercent,
  coefficientOfVariation,
  countEpisodes,
  estimateA1c,
  filterByDays,
  formatGlucose,
  glucoseManagementIndicator,
  standardDeviation,
  timeInRange,
  type EpisodeCounts,
} from './glucoseMath';

export interface ReportSummary {
  days: number;
  from: string;
  to: string;
  readings: number;
  avgMmol: number;
  sdMmol: number;
  cvPercent: number;
  minMmol: number;
  maxMmol: number;
  eA1c: number;
  eA1cMmolMol: number;
  gmi: number;
  cgmActivePercent: number;
  tir: TimeInRange;
  episodes: EpisodeCounts;
  agp: AgpBin[];
  avgDailyCarbsG: number;
  avgDailyRapidUnits: number;
  avgDailyBasalUnits: number;
  adherencePercent: number;
  adherenceStreakDays: number;
  dosesTaken: number;
  dosesDue: number;
}

/** Aggregates everything the clinician report needs for the last `days` days. */
export function buildReportSummary(
  state: DiabetesState,
  days: number,
  now: Date = new Date(),
): ReportSummary {
  const { targetLowMmol: low, targetHighMmol: high } = state.settings;
  const glucose = filterByDays(state.glucose, days, now);
  const values = glucose.map((g) => g.valueMmol);
  const avg = average(values);
  const meals = filterByDays(state.meals, days, now);
  const insulin = filterByDays(state.insulin, days, now);
  const rapid = insulin.filter((d) => d.type !== 'basal').reduce((s, d) => s + d.units, 0);
  const basal = insulin.filter((d) => d.type === 'basal').reduce((s, d) => s + d.units, 0);
  const carbs = meals.reduce((s, m) => s + m.carbsG, 0);
  const adherence = computeAdherence(state, days, now);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const a1c = estimateA1c(avg);

  return {
    days,
    from: toLocalDateKey(start),
    to: toLocalDateKey(now),
    readings: glucose.length,
    avgMmol: avg,
    sdMmol: standardDeviation(values),
    cvPercent: coefficientOfVariation(values),
    minMmol: values.length ? Math.min(...values) : 0,
    maxMmol: values.length ? Math.max(...values) : 0,
    eA1c: a1c,
    eA1cMmolMol: a1cPercentToMmolMol(a1c),
    gmi: glucoseManagementIndicator(avg),
    cgmActivePercent: cgmActivePercent(glucose, days),
    tir: timeInRange(glucose, low, high),
    episodes: countEpisodes(buildAlertEvents(glucose, low, high)),
    agp: buildAgpBins(glucose, low, high),
    avgDailyCarbsG: carbs / days,
    avgDailyRapidUnits: rapid / days,
    avgDailyBasalUnits: basal / days,
    adherencePercent: adherence.percent,
    adherenceStreakDays: adherence.streakDays,
    dosesTaken: adherence.taken,
    dosesDue: adherence.due,
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Quotes a CSV field and neutralises spreadsheet formula injection. */
export function escapeCsv(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) {
    s = `'${s}`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(fields: Array<string | number>): string {
  return fields.map(escapeCsv).join(',');
}

function localStamp(iso: string): string {
  return `${toLocalDateKey(iso)} ${toLocalTime(iso)}`;
}

/** Chronological event log: glucose, meals, insulin and exercise. */
export function buildEventsCsv(state: DiabetesState, unit: GlucoseUnit, days = 14, now: Date = new Date()): string {
  interface EventRow {
    time: string;
    fields: Array<string | number>;
  }
  const rows: EventRow[] = [];

  for (const g of filterByDays(state.glucose, days, now)) {
    rows.push({
      time: g.timestamp,
      fields: [localStamp(g.timestamp), 'Glucose', formatGlucose(g.valueMmol, unit), unit, `${g.source}${g.note ? `: ${g.note}` : ''}`],
    });
  }
  for (const m of filterByDays(state.meals, days, now)) {
    rows.push({
      time: m.timestamp,
      fields: [localStamp(m.timestamp), 'Meal', m.carbsG, 'g carbs', `${m.mealType}: ${m.name}`],
    });
  }
  for (const d of filterByDays(state.insulin, days, now)) {
    rows.push({
      time: d.timestamp,
      fields: [localStamp(d.timestamp), `Insulin (${d.type})`, d.units, 'units', `${d.insulinName}${d.note ? `: ${d.note}` : ''}`],
    });
  }
  for (const e of filterByDays(state.exercise, days, now)) {
    rows.push({
      time: e.timestamp,
      fields: [localStamp(e.timestamp), 'Exercise', e.durationMin, 'min', `${e.activity} (${e.intensity})`],
    });
  }

  rows.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const header = row(['Timestamp (local)', 'Type', 'Value', 'Unit', 'Details']);
  return `${[header, ...rows.map((r) => row(r.fields))].join('\r\n')}\r\n`;
}

/** Two-column summary of the report metrics. */
export function buildSummaryCsv(summary: ReportSummary, state: DiabetesState): string {
  const unit = state.settings.unit;
  const f = (mmol: number): string => formatGlucose(mmol, unit);
  const lines: Array<Array<string | number>> = [
    ['Metric', 'Value'],
    ['Patient', state.settings.patientName],
    ['Report period', `${summary.from} to ${summary.to} (${summary.days} days)`],
    ['Glucose unit', unit],
    ['Readings', summary.readings],
    ['CGM active (%)', summary.cgmActivePercent.toFixed(0)],
    [`Mean glucose (${unit})`, f(summary.avgMmol)],
    [`Glucose SD (${unit})`, f(summary.sdMmol)],
    ['Coefficient of variation (%)', summary.cvPercent.toFixed(1)],
    [`Minimum (${unit})`, f(summary.minMmol)],
    [`Maximum (${unit})`, f(summary.maxMmol)],
    ['Estimated HbA1c (%)', summary.eA1c.toFixed(1)],
    ['Estimated HbA1c (mmol/mol)', summary.eA1cMmolMol.toFixed(0)],
    ['GMI (%)', summary.gmi.toFixed(1)],
    ['Time very low (%)', summary.tir.veryLow.toFixed(1)],
    ['Time low (%)', summary.tir.low.toFixed(1)],
    ['Time in range (%)', summary.tir.inRange.toFixed(1)],
    ['Time high (%)', summary.tir.high.toFixed(1)],
    ['Time very high (%)', summary.tir.veryHigh.toFixed(1)],
    ['Hypoglycemia episodes', summary.episodes.hypoEpisodes],
    ['Severe hypoglycemia episodes (<3.0 mmol/L)', summary.episodes.severeHypoEpisodes],
    ['Hyperglycemia episodes', summary.episodes.hyperEpisodes],
    ['Severe hyperglycemia episodes (>13.9 mmol/L)', summary.episodes.severeHyperEpisodes],
    ['Average daily carbs (g)', summary.avgDailyCarbsG.toFixed(0)],
    ['Average daily rapid-acting insulin (units)', summary.avgDailyRapidUnits.toFixed(1)],
    ['Average daily basal insulin (units)', summary.avgDailyBasalUnits.toFixed(1)],
    ['Medication adherence (%)', summary.adherencePercent.toFixed(0)],
    ['Doses taken / due', `${summary.dosesTaken} / ${summary.dosesDue}`],
    ['Adherence streak (days)', summary.adherenceStreakDays],
  ];
  return `${lines.map(row).join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

/** Triggers a client-side file download. A BOM is added so Excel reads UTF-8 correctly. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([`﻿${content}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function reportFilename(prefix: string, now: Date = new Date()): string {
  return `${prefix}-${toLocalDateKey(now)}.csv`;
}

/** Opens the browser print dialog; the print stylesheet in index.css formats the report. */
export function printReport(): void {
  window.print();
}
