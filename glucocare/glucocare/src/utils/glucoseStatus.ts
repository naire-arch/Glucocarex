import type { AlertLevel } from '../types/diabetes';
import { classifyGlucose } from './glucoseMath';

export type StatusKey = 'urgent-low' | 'low' | 'in-range' | 'high' | 'urgent-high';

export interface StatusStyle {
  key: StatusKey;
  label: string;
  /** One-line plain-language guidance. */
  message: string;
  text: string;
  bg: string;
  border: string;
  dot: string;
  /** Solid, high-contrast fill (white or slate text included). */
  solid: string;
}

const STYLES: Record<StatusKey, StatusStyle> = {
  'urgent-low': {
    key: 'urgent-low',
    label: 'Urgent low',
    message: 'Dangerously low. Treat with fast-acting sugar now and stay with the person.',
    text: 'text-rose-800',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    dot: 'bg-rose-700',
    solid: 'bg-rose-700 text-white',
  },
  low: {
    key: 'low',
    label: 'Low',
    message: 'Below range. Take 15 g of fast-acting carbohydrate and recheck in 15 minutes.',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    solid: 'bg-rose-600 text-white',
  },
  'in-range': {
    key: 'in-range',
    label: 'In range',
    message: 'Within the target range.',
    text: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-600 text-white',
  },
  high: {
    key: 'high',
    label: 'High',
    message: 'Above range. Drink water and follow your care plan.',
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    solid: 'bg-amber-400 text-slate-900',
  },
  'urgent-high': {
    key: 'urgent-high',
    label: 'Urgent high',
    message: 'Very high. Check ketones and contact the care team if it stays high or symptoms appear.',
    text: 'text-amber-900',
    bg: 'bg-amber-100',
    border: 'border-amber-400',
    dot: 'bg-amber-700',
    solid: 'bg-amber-700 text-white',
  },
};

export function getGlucoseStatus(valueMmol: number, low: number, high: number): StatusStyle {
  const level = classifyGlucose(valueMmol, low, high);
  return STYLES[level ?? 'in-range'];
}

export function getStatusStyle(key: StatusKey): StatusStyle {
  return STYLES[key];
}

export function alertLevelStyle(level: AlertLevel): StatusStyle {
  return STYLES[level];
}

export type TrendDirection = 'rising-fast' | 'rising' | 'steady' | 'falling' | 'falling-fast';

/**
 * Rate-of-change trend from two readings. `perHourMmol` thresholds follow
 * common CGM conventions (about 0.06 and 0.11 mmol/L per minute).
 */
export function trendFromRate(perHourMmol: number): TrendDirection {
  if (perHourMmol > 6.6) return 'rising-fast';
  if (perHourMmol > 3.6) return 'rising';
  if (perHourMmol < -6.6) return 'falling-fast';
  if (perHourMmol < -3.6) return 'falling';
  return 'steady';
}

export const TREND_LABEL: Record<TrendDirection, string> = {
  'rising-fast': 'Rising quickly',
  rising: 'Rising',
  steady: 'Steady',
  falling: 'Falling',
  'falling-fast': 'Falling quickly',
};
