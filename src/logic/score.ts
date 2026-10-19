import type { ScoreCategory, Settings, Target } from '../db/types';
import type { DayAgg } from './aggregate';
import { addDays, dayRange, weekdayMon0 } from './dates';

/** score 0..1 of an actual value against a user target (PLAN §5.4) */
export function ruleScore(a: number, t: Pick<Target, 'direction' | 'value' | 'rangeMax'>): number {
  const v = t.value;
  if (!(v > 0)) return 0;
  switch (t.direction) {
    case 'atLeast': return Math.min(1, Math.max(0, a / v));
    case 'atMost': return a <= v ? 1 : Math.max(0, 1 - (a - v) / v);
    case 'range': {
      const hi = t.rangeMax != null && t.rangeMax >= v ? t.rangeMax : v;
      if (a >= v && a <= hi) return 1;
      if (a < v) return Math.max(0, 1 - (v - a) / (0.25 * v));
      return Math.max(0, 1 - (a - hi) / (0.25 * hi));
    }
  }
}

export interface CatScore { cat: ScoreCategory; score: number; actual?: number }
export interface DayScore { score: number | null; cats: CatScore[] }

const usable = (t: Target) => t.enabled && t.value > 0;

/**
 * Per-day Consistency Health. Only categories whose tracker is on AND that have an enabled target / applicable
 * rule that day take part; the user's weights are renormalised over the participants.
 */
export function scoreDay(a: DayAgg, s: Settings, today: string): DayScore {
  const cats: CatScore[] = [];
  const tr = s.trackers, tg = s.targets, n = a.nutrition.total;
  if (tr.water && usable(tg.water)) cats.push({ cat: 'water', score: ruleScore(a.nutrition.waterMl, tg.water), actual: a.nutrition.waterMl });
  if (tr.food) {
    if (usable(tg.calories)) cats.push({ cat: 'calories', score: ruleScore(n.kcal, tg.calories), actual: n.kcal });
    if (usable(tg.protein)) cats.push({ cat: 'protein', score: ruleScore(n.protein, tg.protein), actual: n.protein });
    if (usable(tg.carbs)) cats.push({ cat: 'carbs', score: ruleScore(n.carbs, tg.carbs), actual: n.carbs });
    if (usable(tg.fat)) cats.push({ cat: 'fat', score: ruleScore(n.fat, tg.fat), actual: n.fat });
    if (usable(tg.mealsPerDay)) cats.push({ cat: 'food', score: Math.min(1, a.cleanMeals / tg.mealsPerDay.value), actual: a.cleanMeals });
  }
  // training: only on days the user marked as training days
  if (tr.training && s.trainingDays[weekdayMon0(a.dayKey)]) cats.push({ cat: 'training', score: a.hasWorkout ? 1 : 0 });
  // sleep: the night attributed to this day; today only counts once a night sleep is logged
  if (tr.sleep && usable(tg.sleep) && (a.dayKey < today || a.nightMin !== null)) {
    const h = (a.nightMin ?? 0) / 60;
    cats.push({ cat: 'sleep', score: ruleScore(h, tg.sleep), actual: h });
  }
  if (tr.supplements && a.suppDailyTotal > 0) cats.push({ cat: 'supplements', score: a.suppDailyLogged / a.suppDailyTotal });
  if (tr.checkin) cats.push({ cat: 'checkin', score: a.checkin ? 1 : 0 });
  if (tr.steps && usable(tg.steps)) cats.push({ cat: 'steps', score: ruleScore(a.steps ?? 0, tg.steps), actual: a.steps ?? 0 });
  for (const c of s.customTrackers) {
    const v = a.custom[c.id];
    if (c.kind === 'boolean') cats.push({ cat: `custom:${c.id}`, score: v === true ? 1 : 0 });
    else if (c.target && usable(c.target)) cats.push({ cat: `custom:${c.id}`, score: ruleScore(typeof v === 'number' ? v : 0, c.target), actual: typeof v === 'number' ? v : 0 });
  }
  if (!cats.length) return { score: null, cats };
  const w = (c: ScoreCategory) => Math.max(0, s.score.weights[c] ?? 1);
  let sw = 0, sum = 0;
  for (const c of cats) { sw += w(c.cat); sum += w(c.cat) * c.score; }
  if (sw <= 0) { sw = cats.length; sum = cats.reduce((x, c) => x + c.score, 0); }
  return { score: (100 * sum) / sw, cats };
}

export const labelFor = (score: number | null, labels: Settings['score']['labels']): string | null => {
  if (score == null) return null;
  const hit = labels.filter((l) => l.min <= score).sort((a, b) => b.min - a.min)[0];
  return hit?.label ?? null;
};

interface Ch { startDate: string; endDate: string }
/** days inside [end-6, end] that are in the challenge, not after `today`, and have a score */
export function windowKeys(end: string, c: Ch, today: string, days = 7): string[] {
  const hi = [end, today, c.endDate].sort()[0];
  return dayRange(addDays(hi, -(days - 1)), hi).filter((k) => k >= c.startDate);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface Headline {
  current: number | null; today: number | null; previous: number | null; delta: number | null;
  byCat: Partial<Record<ScoreCategory, number>>; days: number;
}

/** 7-day rolling mean (today included as a live partial), today's live score, and change vs the previous 7-day window */
export function headline(scores: Record<string, DayScore>, today: string, c: Ch): Headline {
  const end = today > c.endDate ? c.endDate : today;
  const cur = windowKeys(end, c, today).map((k) => scores[k]).filter((x): x is DayScore => !!x && x.score != null);
  const prevEnd = addDays(end, -7);
  const prev = prevEnd < c.startDate ? [] : windowKeys(prevEnd, c, today).map((k) => scores[k]).filter((x): x is DayScore => !!x && x.score != null);
  const current = mean(cur.map((x) => x.score!));
  const previous = mean(prev.map((x) => x.score!));
  const byCat: Headline['byCat'] = {};
  const acc = new Map<ScoreCategory, number[]>();
  for (const d of cur) for (const cs of d.cats) { if (!acc.has(cs.cat)) acc.set(cs.cat, []); acc.get(cs.cat)!.push(cs.score); }
  for (const [k, v] of acc) byCat[k] = 100 * (mean(v) ?? 0);
  return {
    current, today: scores[today]?.score ?? null, previous,
    delta: current != null && previous != null ? current - previous : null, byCat, days: cur.length,
  };
}

/** consecutive qualifying days ending today (today may still be in progress and does not break the run) */
export function streak(scores: Record<string, DayScore>, aggs: Record<string, DayAgg>, today: string, c: Ch, threshold: number): number {
  const ok = (k: string) => (threshold > 0 ? (scores[k]?.score ?? -1) >= threshold : !!aggs[k]?.anyLog);
  let k = today > c.endDate ? c.endDate : today;
  if (k >= c.startDate && !ok(k)) k = addDays(k, -1);
  let n = 0;
  while (k >= c.startDate && ok(k)) { n += 1; k = addDays(k, -1); }
  return n;
}
