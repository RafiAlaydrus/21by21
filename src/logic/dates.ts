/**
 * Date logic. A "dayKey" is a local calendar day ("YYYY-MM-DD") computed ONCE at log time and then stored,
 * so changing the phone's timezone later (Malaysia UTC+8 ↔ Indonesia UTC+7) never moves an entry.
 * `tz` is always the JS convention: `new Date().getTimezoneOffset()` (minutes BEHIND UTC, so UTC+8 → -480).
 */
export const pad = (n: number) => String(n).padStart(2, '0');

export interface Parts { y: number; mo: number; d: number; h: number; mi: number; wd: number }

/** wall-clock parts of an instant at a given offset. wd: Monday = 0 … Sunday = 6 */
export function parts(ms: number, tz: number): Parts {
  const d = new Date(ms - tz * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: (d.getUTCDay() + 6) % 7 };
}

export function dayKey(ms: number, tz: number = new Date(ms).getTimezoneOffset()): string {
  const p = parts(ms, tz);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** "HH:mm" shown in the timezone the record was LOGGED in (never the phone's current one). */
export function fmtTime(ms: number, tz: number): string {
  const p = parts(ms, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export const minutesOfDay = (ms: number, tz: number) => { const p = parts(ms, tz); return p.h * 60 + p.mi; };

const utc = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (key: string, n: number): string => {
  const d = new Date(utc(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/** whole days from a to b (b − a) */
export const diffDays = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86400000);
export function dayRange(a: string, b: string): string[] {
  const out: string[] = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}
/** Monday = 0 … Sunday = 6 */
export const weekdayMon0 = (key: string): number => (new Date(utc(key)).getUTCDay() + 6) % 7;
export const weekStart = (key: string): string => addDays(key, -weekdayMon0(key));

/** epoch ms of wall-clock "HH:mm" on `key` in offset `tz` */
export function epochFor(key: string, hhmm: string, tz: number): number {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = key.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, h, m) + tz * 60000;
}

/* ---------- challenge ---------- */
interface ChallengeDates { baselineDate: string; startDate: string; endDate: string; recapDate: string }

export const challengeLength = (c: ChallengeDates) => diffDays(c.startDate, c.endDate) + 1;

/** 0 = baseline day, 1..N = challenge days, null = outside */
export function challengeDay(key: string, c: ChallengeDates): number | null {
  if (key === c.baselineDate) return 0;
  if (key < c.startDate || key > c.endDate) return null;
  return diffDays(c.startDate, key) + 1;
}

export type Phase = 'before' | 'baseline' | 'active' | 'complete';
export function challengePhase(key: string, c: ChallengeDates): Phase {
  if (key > c.endDate) return 'complete';
  if (key >= c.startDate) return 'active';
  if (key === c.baselineDate) return 'baseline';
  return 'before';
}

/** days after today until the end date (Day 8 of 24 → 16). Before the start: the full length. After: 0. */
export function daysLeft(today: string, c: ChallengeDates): number {
  if (today < c.startDate) return challengeLength(c);
  return Math.max(0, diffDays(today, c.endDate));
}
export const daysUntilStart = (today: string, c: ChallengeDates) => Math.max(0, diffDays(today, c.startDate));

/* ---------- sleep attribution ---------- */
/** Night sleep that starts before the cut-off hour (12:00) belongs to the previous day; a nap to its own day. */
export function sleepDayKey(kind: 'night' | 'nap', startMs: number, tz: number, cutoffHour = 12): string {
  const k = dayKey(startMs, tz);
  if (kind === 'nap') return k;
  return parts(startMs, tz).h < cutoffHour ? addDays(k, -1) : k;
}

export const durationMin = (start: number, end: number) => Math.max(0, Math.round((end - start) / 60000));
