import { format, parseISO } from 'date-fns';

export const fmtDay = (key: string, pattern: string) => format(parseISO(key), pattern);
export const fmtDayLong = (key: string) => fmtDay(key, 'EEEE, d MMMM');
export const fmtDayShort = (key: string) => fmtDay(key, 'd MMM');
export const fmtDayWd = (key: string) => fmtDay(key, 'EEE d MMM');

/** 432 min → "7h 12m"; 45 → "45m" */
export function fmtDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
/** seconds → "1:05:09" or "5:09" */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
/** 1 decimal under 10, integer above (macros) */
export const fmtMacro = (n: number) => (Math.abs(n) < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n)));
export const fmt1 = (n: number) => String(Math.round(n * 10) / 10);
export const signed = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 10 ** d) / 10 ** d)}`;
export const fmtMoney = (n: number, cur: string) => `${cur} ${n >= 1000 ? Math.round(n).toLocaleString('en-US') : fmt1(n)}`;
/** minutes since midnight → "HH:mm" (negative / >24h wrap) */
export function fmtMinOfDay(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const agoText = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};
