/** Small date helpers shared by components and utilities (local-time aware). */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar date as "YYYY-MM-DD". */
export function toLocalDateKey(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local time of day as "HH:mm". */
export function toLocalTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value suitable for <input type="datetime-local">. */
export function toDateTimeLocalValue(input: Date | string): string {
  return `${toLocalDateKey(input)}T${toLocalTime(input)}`;
}

/** Parses a datetime-local value (local time) back to an ISO string. */
export function fromDateTimeLocalValue(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "12 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMin = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Combines a local date key and "HH:mm" into a Date in local time. */
export function dateFromKeyAndTime(dateKey: string, time: string): Date {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** Local date keys for the last `days` days, oldest first, ending at `now`. */
export function lastNDateKeys(days: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(toLocalDateKey(d));
  }
  return keys;
}

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
