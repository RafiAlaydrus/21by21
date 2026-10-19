import type { Settings, Supplement } from '../db/types';
import type { DayAgg } from './aggregate';
import { weekdayMon0 } from './dates';
import { C } from '../theme';

export interface TodoItem {
  id: string;
  kind: 'water' | 'meal' | 'supplement' | 'training' | 'checkin' | 'weighin' | 'measurements' | 'photos' | 'steps' | 'custom';
  label: string; color: string; hint: string;
  progress?: { value: number; target: number; unit: string };
  supplementId?: string; mealLabel?: string; trackerId?: string;
}

const usable = (t: { enabled: boolean; value: number }) => t.enabled && t.value > 0;

/** "Still to log today" (PLAN §5.5): every participating category that is not yet at 100 % today, in the fixed order. */
export function stillToLog(a: DayAgg, s: Settings, supplements: Supplement[], ctx: { hasMeasurement: boolean; hasPhotos: boolean }): TodoItem[] {
  const out: TodoItem[] = [];
  const tr = s.trackers, tg = s.targets, k = a.dayKey;

  if (tr.water && usable(tg.water) && tg.water.direction !== 'atMost' && a.nutrition.waterMl < tg.water.value)
    out.push({ id: 'water', kind: 'water', label: 'Water', color: C.blue, hint: '', progress: { value: a.nutrition.waterMl, target: tg.water.value, unit: 'ml' } });

  if (tr.food && usable(tg.mealsPerDay) && a.mealsLogged < tg.mealsPerDay.value) {
    const expected = s.mealLabels.slice(0, Math.round(tg.mealsPerDay.value));
    const used = new Set(a.meals.map((m) => m.label));
    const missing = expected.filter((l) => !used.has(l)).slice(0, Math.round(tg.mealsPerDay.value) - a.mealsLogged);
    for (const l of missing) out.push({ id: `meal:${l}`, kind: 'meal', label: `${l} not logged`, color: C.orange, hint: 'Log', mealLabel: l });
  }

  if (tr.supplements) {
    const logged = new Set(a.supplementLogs.map((l) => l.supplementId));
    for (const sp of supplements.filter((x) => x.daily && !logged.has(x.id)))
      out.push({ id: `supp:${sp.id}`, kind: 'supplement', label: `${sp.name} not logged`, color: C.cyan, hint: '1 tap', supplementId: sp.id });
  }

  if (tr.training && s.trainingDays[weekdayMon0(k)] && !a.hasWorkout)
    out.push({ id: 'training', kind: 'training', label: 'Training not logged', color: C.red, hint: 'Log' });

  if (tr.checkin && !a.checkin) out.push({ id: 'checkin', kind: 'checkin', label: 'Daily check-in', color: C.yellow, hint: 'Log' });

  if (s.challenge.weighInDates.includes(k) && !a.weighIn) out.push({ id: 'weighin', kind: 'weighin', label: 'Weigh-in', color: '#F5F5F7', hint: 'Log' });
  if (s.challenge.measurementDates.includes(k) && !ctx.hasMeasurement) out.push({ id: 'measurements', kind: 'measurements', label: 'Measurements', color: '#F5F5F7', hint: 'Log' });
  if (s.challenge.progressPhotoDates.includes(k) && !ctx.hasPhotos) out.push({ id: 'photos', kind: 'photos', label: 'Progress photos', color: '#F5F5F7', hint: 'Log' });

  if (tr.steps && usable(tg.steps) && a.steps == null) out.push({ id: 'steps', kind: 'steps', label: 'Steps not logged', color: C.green, hint: 'Log' });

  for (const c of s.customTrackers)
    if (a.custom[c.id] === undefined && (c.kind === 'boolean' || (c.target && usable(c.target))))
      out.push({ id: `custom:${c.id}`, kind: 'custom', label: `${c.name} not logged`, color: C.cyan, hint: 'Log', trackerId: c.id });

  return out;
}
