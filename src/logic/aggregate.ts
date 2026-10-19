import type * as T from '../db/types';
import { dayNutrition, dayExactPct } from './nutrition';
import type { DayNutrition } from './nutrition';
import { isWork, setVolume } from './prs';
import { durationMin } from './dates';

/** The subset of records the aggregates need (AppData satisfies this structurally). */
export interface Slice {
  settings: T.Settings; meals: T.Meal[]; drinks: T.Drink[]; drinkTypes: T.DrinkType[]; supplements: T.Supplement[];
  supplementLogs: T.SupplementLog[]; workouts: T.Workout[]; sleeps: T.Sleep[]; checkins: T.Checkin[]; steps: T.StepsRec[];
  customLogs: T.CustomLog[]; cravings: T.Craving[]; weighIns: T.WeighIn[]; measurements: T.Measurement[]; dayNotes: T.DayNote[];
  dayTags: T.DayTagRec[]; progressPhotos: T.ProgressPhoto[]; soreness: T.SorenessRec[];
}

export interface DayAgg {
  dayKey: string;
  nutrition: DayNutrition;
  exactPct: number | null;
  meals: T.Meal[]; mealsLogged: number; cleanMeals: number;
  drinks: T.Drink[]; supplementLogs: T.SupplementLog[];
  suppDailyTotal: number; suppDailyLogged: number;
  workouts: T.Workout[]; hasWorkout: boolean; volumeKg: number; setCount: number; workoutMin: number;
  sleeps: T.Sleep[]; nightMin: number | null; napMin: number;
  checkin?: T.Checkin; steps?: number; cravings: T.Craving[];
  custom: Record<string, boolean | number>;
  weighIn?: T.WeighIn;
  anyLog: boolean;
}

const group = <R extends { dayKey: string }>(rows: R[]): Map<string, R[]> => {
  const m = new Map<string, R[]>();
  for (const r of rows) { const l = m.get(r.dayKey); if (l) l.push(r); else m.set(r.dayKey, [r]); }
  return m;
};

export function workoutMinutes(w: T.Workout): number {
  return w.checkOut ? durationMin(w.checkIn, w.checkOut) : 0;
}
export const workoutVolume = (w: T.Workout) => w.sets.filter(isWork).reduce((a, s) => a + setVolume(s), 0);
export const workoutHasWork = (w: T.Workout) => w.sets.some((s) => !!s.doneAt) || w.cardio.length > 0;

/** Build the per-day aggregate for the given keys. */
export function aggregateDays(d: Slice, keys: string[]): Record<string, DayAgg> {
  const gMeals = group(d.meals), gDrinks = group(d.drinks), gSupp = group(d.supplementLogs), gWork = group(d.workouts), gSleep = group(d.sleeps);
  const gCheck = group(d.checkins), gSteps = group(d.steps), gCustom = group(d.customLogs), gCrave = group(d.cravings), gWeigh = group(d.weighIns);
  const gMeas = group(d.measurements), gNote = group(d.dayNotes), gTags = group(d.dayTags), gPhoto = group(d.progressPhotos), gSore = group(d.soreness);
  const dailySupps = d.supplements.filter((s) => s.daily);
  const out: Record<string, DayAgg> = {};
  for (const k of keys) {
    const meals = (gMeals.get(k) ?? []).slice().sort((a, b) => a.time - b.time);
    const drinks = gDrinks.get(k) ?? [];
    const supplementLogs = gSupp.get(k) ?? [];
    const workouts = (gWork.get(k) ?? []).slice().sort((a, b) => a.checkIn - b.checkIn);
    const sleeps = gSleep.get(k) ?? [];
    const nights = sleeps.filter((s) => s.kind === 'night' && s.end);
    const naps = sleeps.filter((s) => s.kind === 'nap' && s.end);
    const cust: Record<string, boolean | number> = {};
    for (const c of gCustom.get(k) ?? []) cust[c.trackerId] = c.value;
    const logged = new Set(supplementLogs.map((l) => l.supplementId));
    const steps = gSteps.get(k)?.[0]?.steps;
    const checkin = gCheck.get(k)?.[0];
    out[k] = {
      dayKey: k,
      nutrition: dayNutrition(meals, drinks, d.drinkTypes, supplementLogs, d.supplements),
      exactPct: dayExactPct(meals),
      meals, mealsLogged: meals.length, cleanMeals: meals.filter((m) => m.clean).length,
      drinks, supplementLogs,
      suppDailyTotal: dailySupps.length, suppDailyLogged: dailySupps.filter((s) => logged.has(s.id)).length,
      workouts,
      hasWorkout: workouts.some(workoutHasWork),
      volumeKg: workouts.reduce((a, w) => a + workoutVolume(w), 0),
      setCount: workouts.reduce((a, w) => a + w.sets.filter(isWork).length, 0),
      workoutMin: workouts.reduce((a, w) => a + workoutMinutes(w), 0),
      sleeps,
      nightMin: nights.length ? nights.reduce((a, s) => a + (s.durationMin ?? durationMin(s.start, s.end!)), 0) : null,
      napMin: naps.reduce((a, s) => a + (s.durationMin ?? durationMin(s.start, s.end!)), 0),
      checkin, steps, cravings: gCrave.get(k) ?? [], custom: cust, weighIn: gWeigh.get(k)?.[0],
      anyLog: !!(meals.length || drinks.length || supplementLogs.length || workouts.length || sleeps.length || checkin || steps != null
        || Object.keys(cust).length || gCrave.get(k)?.length || gWeigh.get(k)?.length || gMeas.get(k)?.length || gNote.get(k)?.length
        || gTags.get(k)?.length || gPhoto.get(k)?.length || gSore.get(k)?.length),
    };
  }
  return out;
}
