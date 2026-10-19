import { defaultSettings } from '../db/defaults';
import type { Settings, Meal, MealItem, Workout, WorkoutSet, Nutrients } from '../db/types';
import type { Slice } from './aggregate';

export const emptySlice = (settings: Settings = defaultSettings()): Slice => ({
  settings, meals: [], drinks: [], drinkTypes: [], supplements: [], supplementLogs: [], workouts: [], sleeps: [], checkins: [], steps: [],
  customLogs: [], cravings: [], weighIns: [], measurements: [], dayNotes: [], dayTags: [], progressPhotos: [], soreness: [],
});

let n = 0;
export const id = () => `id${++n}`;
const base = () => ({ id: id(), createdAt: 0, updatedAt: 0 });

export const per100 = (kcal: number, protein = 0, carbs = 0, fat = 0): Nutrients => ({ kcal, protein, carbs, fat });
export const item = (amount: number, p: Nutrients, estimated = false): MealItem =>
  ({ id: id(), name: 'x', amount, basis: 'g', per100: p, source: 'user', estimated, isSeasoning: false });
export const meal = (dayKey: string, items: MealItem[], extra: Partial<Meal> = {}): Meal =>
  ({ ...base(), dayKey, time: Date.UTC(2026, 10, 2, 12), tzOffsetMin: -480, label: 'Lunch', mode: 'cooked', photoId: 'p', items, clean: true, ...extra });
export const set = (exerciseId: string, weightKg: number, reps: number, order = 0, extra: Partial<WorkoutSet> = {}): WorkoutSet =>
  ({ id: id(), exerciseId, order, weightKg, reps, doneAt: 1, ...extra });
export const workout = (dayKey: string, checkIn: number, sets: WorkoutSet[], extra: Partial<Workout> = {}): Workout =>
  ({ ...base(), dayKey, checkIn, tzOffsetMin: -480, title: 'Push', sets, cardio: [], exerciseIds: [...new Set(sets.map((s) => s.exerciseId))], ...extra });
