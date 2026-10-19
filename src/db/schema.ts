import Dexie from 'dexie';
import type { Table } from 'dexie';
import type * as T from './types';

export const SCHEMA_VERSION = 1;

class AppDB extends Dexie {
  settings!: Table<T.Settings, string>;
  blobs!: Table<T.BlobRec, string>;
  foods!: Table<T.Food, string>;
  meals!: Table<T.Meal, string>;
  recipes!: Table<T.Recipe, string>;
  drinkTypes!: Table<T.DrinkType, string>;
  drinks!: Table<T.Drink, string>;
  supplements!: Table<T.Supplement, string>;
  supplementLogs!: Table<T.SupplementLog, string>;
  exercises!: Table<T.Exercise, string>;
  gyms!: Table<T.Gym, string>;
  workouts!: Table<T.Workout, string>;
  sleeps!: Table<T.Sleep, string>;
  weighIns!: Table<T.WeighIn, string>;
  measurements!: Table<T.Measurement, string>;
  progressPhotos!: Table<T.ProgressPhoto, string>;
  checkins!: Table<T.Checkin, string>;
  soreness!: Table<T.SorenessRec, string>;
  cravings!: Table<T.Craving, string>;
  steps!: Table<T.StepsRec, string>;
  dayTags!: Table<T.DayTagRec, string>;
  dayNotes!: Table<T.DayNote, string>;
  reminders!: Table<T.Reminder, string>;
  customLogs!: Table<T.CustomLog, string>;
  meta!: Table<T.MetaRow, string>;

  constructor() {
    super('21by21');
    this.version(1).stores({
      settings: 'id',
      blobs: 'id, kind',
      foods: 'id, name, barcode, lastUsedAt',
      meals: 'id, dayKey, [dayKey+time]',
      recipes: 'id, name',
      drinkTypes: 'id, name',
      drinks: 'id, dayKey, [dayKey+time]',
      supplements: 'id, name',
      supplementLogs: 'id, dayKey, supplementId',
      exercises: 'id, name',
      gyms: 'id',
      workouts: 'id, dayKey, *exerciseIds',
      sleeps: 'id, dayKey, start',
      weighIns: 'id, dayKey',
      measurements: 'id, dayKey',
      progressPhotos: 'id, dayKey, pose',
      checkins: 'id, dayKey',
      soreness: 'id, dayKey',
      cravings: 'id, dayKey',
      steps: 'id, dayKey',
      dayTags: 'id, dayKey',
      dayNotes: 'id, dayKey',
      reminders: 'id, at',
      customLogs: 'id, dayKey, trackerId',
      meta: 'key',
    });
  }
}

export const db = new AppDB();

/** every table name that holds user data, in backup order */
export const DATA_TABLES = [
  'foods', 'meals', 'recipes', 'drinkTypes', 'drinks', 'supplements', 'supplementLogs', 'exercises', 'gyms',
  'workouts', 'sleeps', 'weighIns', 'measurements', 'progressPhotos', 'checkins', 'soreness', 'cravings',
  'steps', 'dayTags', 'dayNotes', 'reminders', 'customLogs', 'meta',
] as const;
