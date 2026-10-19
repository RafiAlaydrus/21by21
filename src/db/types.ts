export type Direction = 'atLeast' | 'atMost' | 'range';
export interface Target { enabled: boolean; value: number; direction: Direction; rangeMax?: number; unit: string }

export type ScoreCategory =
  | 'training' | 'food' | 'water' | 'calories' | 'protein' | 'carbs' | 'fat'
  | 'sleep' | 'supplements' | 'checkin' | 'steps' | `custom:${string}`;

export interface CustomTracker { id: string; name: string; kind: 'boolean' | 'number'; unit?: string; target?: Target }

export interface TrackerToggles {
  training: boolean; food: boolean; water: boolean; drinks: boolean; supplements: boolean;
  sleep: boolean; checkin: boolean; cravings: boolean; soreness: boolean; steps: boolean;
  tags: boolean; spending: boolean; reminders: boolean;
}

export interface Settings {
  id: 'settings';
  challenge: {
    name: string; baselineDate: string; startDate: string; endDate: string; recapDate: string;
    weighInDates: string[]; measurementDates: string[]; progressPhotoDates: string[];
  };
  targets: {
    calories: Target; protein: Target; carbs: Target; fat: Target; water: Target;
    sleep: Target; steps: Target; gymPerWeek: Target; mealsPerDay: Target;
  };
  trainingDays: boolean[];
  trackers: TrackerToggles;
  score: { weights: Record<string, number>; labels: { min: number; label: string }[]; streakThreshold: number };
  customTrackers: CustomTracker[];
  quickWater: { id: string; label: string; ml: number }[];
  mealLabels: string[];
  cookingMethods: string[];
  supplementUnits: string[];
  timingTags: string[];
  bodyParts: { id: string; name: string }[];
  dayTags: string[];
  currencies: string[];
  sleepNightCutoffHour: number;
  restTimer: { enabled: boolean; seconds: number };
  backupReminderDays: number;
  lastBackupAt?: number;
  createdAt: number;
  updatedAt: number;
}

/* ---------- common record shapes ---------- */
export interface Rec { id: string; createdAt: number; updatedAt: number; editedLate?: boolean }
export interface Timed { time: number; tzOffsetMin: number }
export interface Daily { dayKey: string }

export interface Nutrients { kcal: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number; sodiumMg?: number }
export type Macros4 = Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'>;
export type FoodSource = 'label' | 'barcode' | 'usda' | 'tkpi' | 'myfcd' | 'user';
export interface Money { amount: number; currency: string }

export interface BlobRec extends Rec { kind: 'meal' | 'progress' | 'other'; full: Blob; thumb: Blob; takenAt: number }

export interface Food extends Rec {
  name: string; brand?: string; basis: 'g' | 'ml'; per100: Nutrients; defaultState?: 'raw' | 'cooked';
  note?: string; source: FoodSource; barcode?: string; refId?: string; useCount: number; lastUsedAt: number;
}

export interface MealItem {
  id: string; foodId?: string; name: string; brand?: string; amount: number; basis: 'g' | 'ml';
  state?: 'raw' | 'cooked'; per100: Nutrients; source: FoodSource; estimated: boolean; isSeasoning: boolean; note?: string;
}

export interface Meal extends Rec, Daily, Timed {
  label: string; mode: 'bought' | 'cooked'; photoId: string; items: MealItem[]; place?: string; price?: Money;
  method?: string; cookTimeMin?: number; tool?: string; wholeDishG?: number; eatenG?: number;
  clean: boolean; note?: string; recipeId?: string; cost?: Money;
}

export interface Recipe extends Rec {
  name: string; mode: 'bought' | 'cooked'; items: MealItem[]; method?: string; tool?: string; cookTimeMin?: number;
  place?: string; wholeDishG?: number; price?: Money; cost?: Money;
}

export interface DrinkType extends Rec { name: string; per100ml?: Macros4 }
export interface Drink extends Rec, Daily, Timed { kind: 'water' | 'other'; drinkTypeId?: string; ml: number }

export interface Supplement extends Rec {
  name: string; brand?: string; defaultAmount: number; unit: string; timingTag?: string; daily: boolean; perServing?: Macros4;
}
export interface SupplementLog extends Rec, Daily, Timed { supplementId: string; name: string; amount: number; unit: string; timingTag?: string }

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Full body', 'Cardio'] as const;
export interface Exercise extends Rec { name: string; muscleGroups: string[]; kind: 'strength' | 'cardio' }
export interface Gym extends Rec { name: string; note?: string; equipment: string[]; lat?: number; lng?: number }

export interface WorkoutSet { id: string; exerciseId: string; order: number; weightKg: number; reps: number; isWarmup?: boolean; doneAt?: number }
export interface CardioEntry { id: string; exerciseId: string; durationMin: number; speedKmh?: number; inclinePct?: number; distanceKm?: number; kcal?: number }
export interface Workout extends Rec, Daily {
  checkIn: number; checkOut?: number; tzOffsetMin: number; gymId?: string; title: string; rating?: number; note?: string;
  sets: WorkoutSet[]; cardio: CardioEntry[]; exerciseIds: string[];
}

export interface Sleep extends Rec, Daily {
  kind: 'night' | 'nap'; start: number; end?: number; tzOffsetMin: number; endTzOffsetMin?: number; durationMin?: number;
}
export interface WeighIn extends Rec, Daily, Timed { kg: number; note?: string }
export interface Measurement extends Rec, Daily { values: Record<string, number>; note?: string }
export interface ProgressPhoto extends Rec, Daily { pose: 'front' | 'side' | 'back'; blobId: string }
export interface Checkin extends Rec, Daily {
  energy: number; mood: number; hunger: number; stress: number; soreness: number; dayRating: number; note?: string;
}
export interface SorenessRec extends Rec, Daily { muscles: Record<string, 0 | 1 | 2 | 3> }
export interface Craving extends Rec, Daily, Timed { what: string; strength: number; outcome: 'resisted' | 'ate'; note?: string }
export interface StepsRec extends Rec, Daily { steps: number }
export interface DayTagRec extends Rec, Daily { tags: string[] }
export interface DayNote extends Rec, Daily { text: string }
export interface Reminder extends Rec { text: string; at: number; done: boolean; tzOffsetMin: number }
export interface CustomLog extends Rec, Daily { trackerId: string; value: boolean | number }
export interface MetaRow { key: string; value: unknown }

export interface ActiveSleep { kind: 'night' | 'nap'; start: number; tzOffsetMin: number }

export type TableName =
  | 'blobs' | 'foods' | 'meals' | 'recipes' | 'drinkTypes' | 'drinks' | 'supplements' | 'supplementLogs'
  | 'exercises' | 'gyms' | 'workouts' | 'sleeps' | 'weighIns' | 'measurements' | 'progressPhotos'
  | 'checkins' | 'soreness' | 'cravings' | 'steps' | 'dayTags' | 'dayNotes' | 'reminders' | 'customLogs';
