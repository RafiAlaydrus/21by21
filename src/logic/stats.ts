import type { Craving, Exercise, Meal, Money, Sleep, WeighIn, Workout } from '../db/types';
import type { DayAgg } from './aggregate';
import type { DayScore } from './score';
import { isWork, setVolume } from './prs';
import { addDays, challengeLength, diffDays, minutesOfDay, parts } from './dates';

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]): number | null => (xs.length ? sum(xs) / xs.length : null);
/** population standard deviation */
export function sd(xs: number[]): number | null {
  const m = mean(xs);
  return m == null ? null : Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length);
}
export const defined = (xs: (number | null | undefined)[]): number[] => xs.filter((x): x is number => x != null && !Number.isNaN(x));

export interface KeyVal { key: string; v: number }
export function extremes(points: KeyVal[]): { min?: KeyVal; max?: KeyVal } {
  if (!points.length) return {};
  return { min: points.reduce((a, b) => (b.v < a.v ? b : a)), max: points.reduce((a, b) => (b.v > a.v ? b : a)) };
}

/** mean of the last 7 values vs the 7 before them (nulls skipped). delta = null when either window is empty. */
export function trend7(vals: (number | null)[]): { cur: number | null; prev: number | null; delta: number | null } {
  const cur = mean(defined(vals.slice(-7))), prev = mean(defined(vals.slice(-14, -7)));
  return { cur, prev, delta: cur != null && prev != null ? cur - prev : null };
}

/* ---------- eating ---------- */
/** first → last meal of the day, in minutes (needs ≥ 2 meals) */
export function eatingWindowMin(meals: Pick<Meal, 'time'>[]): number | null {
  if (meals.length < 2) return null;
  const t = meals.map((m) => m.time);
  return Math.round((Math.max(...t) - Math.min(...t)) / 60000);
}
/** last meal yesterday → first meal today, in minutes */
export function overnightGapMin(prev: Pick<Meal, 'time'>[], cur: Pick<Meal, 'time'>[]): number | null {
  if (!prev.length || !cur.length) return null;
  return Math.round((Math.min(...cur.map((m) => m.time)) - Math.max(...prev.map((m) => m.time))) / 60000);
}

export interface Spend { total: number; cooked: number; bought: number }
/** spend per currency; currencies are never converted */
export function spendByCurrency(meals: Meal[]): Record<string, Spend> {
  const out: Record<string, Spend> = {};
  const add = (m: Money | undefined, kind: 'cooked' | 'bought') => {
    if (!m || !(m.amount > 0)) return;
    const o = (out[m.currency] ??= { total: 0, cooked: 0, bought: 0 });
    o.total += m.amount; o[kind] += m.amount;
  };
  for (const m of meals) { if (m.mode === 'bought') add(m.price, 'bought'); else add(m.cost, 'cooked'); }
  return out;
}

/** cravings per local hour of day (24 buckets, using each craving's own logged offset) */
export function cravingsByHour(cravings: Craving[]): number[] {
  const h = new Array<number>(24).fill(0);
  for (const c of cravings) h[parts(c.time, c.tzOffsetMin).h] += 1;
  return h;
}

/* ---------- training ---------- */
export interface MuscleShare { group: string; volume: number; pct: number }
/** a set's volume is credited to every muscle group of its exercise, divided equally */
export function muscleSplit(workouts: Workout[], exercises: Exercise[]): MuscleShare[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const vol = new Map<string, number>();
  for (const w of workouts) for (const s of w.sets) {
    if (!isWork(s)) continue;
    const groups = byId.get(s.exerciseId)?.muscleGroups ?? [];
    if (!groups.length) continue;
    const share = setVolume(s) / groups.length;
    for (const g of groups) vol.set(g, (vol.get(g) ?? 0) + share);
  }
  const total = sum([...vol.values()]);
  return [...vol].map(([group, volume]) => ({ group, volume, pct: total ? (volume / total) * 100 : 0 })).sort((a, b) => b.volume - a.volume);
}

export interface WeekBucket { index: number; start: string; end: string; days: number; sessions: number; volume: number }
/** challenge weeks of 7 days counted from Day 1 (the last bucket may be partial) */
export function weekBuckets(aggs: Record<string, DayAgg>, c: { startDate: string; endDate: string }, upTo: string): WeekBucket[] {
  const n = challengeLength({ ...c, baselineDate: '', recapDate: '' });
  const out: WeekBucket[] = [];
  for (let i = 0; i * 7 < n; i++) {
    const start = addDays(c.startDate, i * 7);
    const last = addDays(start, 6);
    const end = last > c.endDate ? c.endDate : last;
    let sessions = 0, volume = 0;
    for (let k = start; k <= end && k <= upTo; k = addDays(k, 1)) {
      const a = aggs[k];
      if (a) { sessions += a.workouts.filter((w) => w.sets.some((s) => s.doneAt) || w.cardio.length).length; volume += a.volumeKg; }
    }
    out.push({ index: i + 1, start, end, days: diffDays(start, end) + 1, sessions, volume });
  }
  return out;
}

/* ---------- body ---------- */
export interface WeightSegment { from: WeighIn; to: WeighIn; delta: number; days: number; perWeek: number }
export function weightSegments(w: WeighIn[]): WeightSegment[] {
  const s = [...w].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const out: WeightSegment[] = [];
  for (let i = 1; i < s.length; i++) {
    const days = Math.max(1, diffDays(s[i - 1].dayKey, s[i].dayKey));
    const delta = s[i].kg - s[i - 1].kg;
    out.push({ from: s[i - 1], to: s[i], delta, days, perWeek: (delta / days) * 7 });
  }
  return out;
}

/* ---------- sleep clock ---------- */
/** bedtimes after 12:00 count as minus 24 h so 23:30 and 00:30 average sensibly */
const bedMin = (ms: number, tz: number) => { const m = minutesOfDay(ms, tz); return m >= 720 ? m - 1440 : m; };
export function sleepClock(sleeps: Sleep[]): { bed: { mean: number; sd: number } | null; wake: { mean: number; sd: number } | null } {
  const nights = sleeps.filter((s) => s.kind === 'night' && s.end);
  if (!nights.length) return { bed: null, wake: null };
  const bed = nights.map((s) => bedMin(s.start, s.tzOffsetMin));
  const wake = nights.map((s) => minutesOfDay(s.end!, s.endTzOffsetMin ?? s.tzOffsetMin));
  return { bed: { mean: mean(bed)!, sd: sd(bed)! }, wake: { mean: mean(wake)!, sd: sd(wake)! } };
}

/* ---------- correlation ---------- */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = sum(xs) / n, my = sum(ys) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

export interface Metric { id: string; label: string; unit: string; get: (a: DayAgg, score: DayScore | undefined) => number | undefined }
export const METRICS: Metric[] = [
  { id: 'sleep', label: 'Sleep', unit: 'h', get: (a) => (a.nightMin != null ? a.nightMin / 60 : undefined) },
  { id: 'nap', label: 'Nap', unit: 'min', get: (a) => (a.napMin > 0 ? a.napMin : undefined) },
  { id: 'energy', label: 'Energy', unit: '/10', get: (a) => a.checkin?.energy },
  { id: 'mood', label: 'Mood', unit: '/10', get: (a) => a.checkin?.mood },
  { id: 'hunger', label: 'Hunger', unit: '/10', get: (a) => a.checkin?.hunger },
  { id: 'stress', label: 'Stress', unit: '/10', get: (a) => a.checkin?.stress },
  { id: 'soreness', label: 'Soreness', unit: '/10', get: (a) => a.checkin?.soreness },
  { id: 'rating', label: 'Day rating', unit: '/10', get: (a) => a.checkin?.dayRating },
  { id: 'water', label: 'Water', unit: 'ml', get: (a) => a.nutrition.waterMl },
  { id: 'kcal', label: 'Calories', unit: 'kcal', get: (a) => (a.mealsLogged ? a.nutrition.total.kcal : undefined) },
  { id: 'protein', label: 'Protein', unit: 'g', get: (a) => (a.mealsLogged ? a.nutrition.total.protein : undefined) },
  { id: 'carbs', label: 'Carbs', unit: 'g', get: (a) => (a.mealsLogged ? a.nutrition.total.carbs : undefined) },
  { id: 'fat', label: 'Fat', unit: 'g', get: (a) => (a.mealsLogged ? a.nutrition.total.fat : undefined) },
  { id: 'volume', label: 'Workout volume', unit: 'kg', get: (a) => (a.volumeKg > 0 ? a.volumeKg : undefined) },
  { id: 'duration', label: 'Workout duration', unit: 'min', get: (a) => (a.workoutMin > 0 ? a.workoutMin : undefined) },
  { id: 'steps', label: 'Steps', unit: '', get: (a) => a.steps },
  { id: 'weight', label: 'Weight', unit: 'kg', get: (a) => a.weighIn?.kg },
  { id: 'score', label: 'Day score', unit: '', get: (_a, s) => (s?.score != null ? s.score : undefined) },
  { id: 'cravings', label: 'Cravings', unit: '', get: (a) => a.cravings.length },
];

export interface Pair { x: number; y: number; key: string }
/** x from day k, y from day k (or k+1 with `nextDay`). Days missing either value are skipped. */
export function buildPairs(keys: string[], aggs: Record<string, DayAgg>, scores: Record<string, DayScore>, mx: Metric, my: Metric, nextDay: boolean): Pair[] {
  const out: Pair[] = [];
  for (const k of keys) {
    const x = aggs[k] ? mx.get(aggs[k], scores[k]) : undefined;
    const yk = nextDay ? addDays(k, 1) : k;
    const y = aggs[yk] ? my.get(aggs[yk], scores[yk]) : undefined;
    if (x != null && y != null) out.push({ x, y, key: k });
  }
  return out;
}
