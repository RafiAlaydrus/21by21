import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ensureSettings } from '../db/ops';
import { mergeSettings } from '../db/defaults';
import { dayKey } from '../logic/dates';
import { useNow } from './useNow';
import type * as T from '../db/types';

export interface AppData {
  settings: T.Settings;
  foods: T.Food[]; meals: T.Meal[]; recipes: T.Recipe[]; drinkTypes: T.DrinkType[]; drinks: T.Drink[];
  supplements: T.Supplement[]; supplementLogs: T.SupplementLog[]; exercises: T.Exercise[]; gyms: T.Gym[];
  workouts: T.Workout[]; sleeps: T.Sleep[]; weighIns: T.WeighIn[]; measurements: T.Measurement[];
  progressPhotos: T.ProgressPhoto[]; checkins: T.Checkin[]; soreness: T.SorenessRec[]; cravings: T.Craving[];
  steps: T.StepsRec[]; dayTags: T.DayTagRec[]; dayNotes: T.DayNote[]; reminders: T.Reminder[]; customLogs: T.CustomLog[];
  meta: Record<string, unknown>;
  activeSleep?: T.ActiveSleep;
  onboarded: boolean;
  today: string;
}

const Ctx = createContext<AppData | null>(null);

/** One live query for every small table: 24 days of data is tiny, so screens derive everything in memory. */
export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  useEffect(() => { void ensureSettings(); }, []);
  const now = useNow(20000);
  const raw = useLiveQuery(async () => {
    const [settings, foods, meals, recipes, drinkTypes, drinks, supplements, supplementLogs, exercises, gyms, workouts, sleeps,
      weighIns, measurements, progressPhotos, checkins, soreness, cravings, steps, dayTags, dayNotes, reminders, customLogs, metaRows] = await Promise.all([
      db.settings.get('settings'), db.foods.toArray(), db.meals.toArray(), db.recipes.toArray(), db.drinkTypes.toArray(), db.drinks.toArray(),
      db.supplements.toArray(), db.supplementLogs.toArray(), db.exercises.toArray(), db.gyms.toArray(), db.workouts.toArray(), db.sleeps.toArray(),
      db.weighIns.toArray(), db.measurements.toArray(), db.progressPhotos.toArray(), db.checkins.toArray(), db.soreness.toArray(), db.cravings.toArray(),
      db.steps.toArray(), db.dayTags.toArray(), db.dayNotes.toArray(), db.reminders.toArray(), db.customLogs.toArray(), db.meta.toArray(),
    ]);
    const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
    return {
      settings: mergeSettings(settings), foods, meals, recipes, drinkTypes, drinks, supplements, supplementLogs, exercises, gyms, workouts, sleeps,
      weighIns, measurements, progressPhotos, checkins, soreness, cravings, steps, dayTags, dayNotes, reminders, customLogs, meta,
      activeSleep: meta.activeSleep as T.ActiveSleep | undefined, onboarded: !!meta.onboarded,
    };
  }, []);
  const today = dayKey(now);
  const value = useMemo(() => (raw ? { ...raw, today } : null), [raw, today]);
  if (!value) return <>{fallback ?? null}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}
export const useSettings = () => useData().settings;
