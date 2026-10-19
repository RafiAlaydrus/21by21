import type { Settings, Target } from './types';

const off = (unit: string, direction: Target['direction'] = 'atLeast'): Target => ({ enabled: false, value: 0, direction, unit });

/** Fresh settings. Everything the user can set starts empty / disabled except water (3000 ml) and gym/week (5). */
export function defaultSettings(): Settings {
  const now = Date.now();
  return {
    id: 'settings',
    challenge: {
      name: '21 by 21',
      baselineDate: '2026-10-25',
      startDate: '2026-10-26',
      endDate: '2026-11-18',
      recapDate: '2026-11-19',
      weighInDates: ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-18'],
      measurementDates: ['2026-10-25', '2026-11-18'],
      progressPhotoDates: ['2026-10-25', '2026-11-18'],
    },
    targets: {
      calories: off('kcal'),
      protein: off('g'),
      carbs: off('g'),
      fat: off('g'),
      water: { enabled: true, value: 3000, direction: 'atLeast', unit: 'ml' },
      sleep: off('h'),
      steps: off('steps'),
      gymPerWeek: { enabled: true, value: 5, direction: 'atLeast', unit: 'sessions' },
      mealsPerDay: off('meals'),
    },
    trainingDays: [false, false, false, false, false, false, false],
    trackers: {
      training: true, food: true, water: true, drinks: true, supplements: true, sleep: true, checkin: true,
      cravings: true, soreness: true, steps: true, tags: true, spending: true, reminders: true,
    },
    score: { weights: {}, labels: [], streakThreshold: 0 },
    customTrackers: [],
    quickWater: [],
    mealLabels: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
    cookingMethods: ['Pan-fried', 'Boiled', 'Air-fried', 'Grilled', 'Steamed', 'Baked', 'Raw'],
    supplementUnits: ['g', 'mg', 'ml', 'tsp', 'tbsp', 'scoop', 'capsule', 'tablet'],
    timingTags: ['Morning', 'With lunch', 'With dinner', 'Before gym', 'After gym', 'Before bed'],
    bodyParts: ['Neck', 'Shoulders', 'Chest', 'Arm (L)', 'Arm (R)', 'Waist', 'Hips', 'Thigh (L)', 'Thigh (R)', 'Calf (L)', 'Calf (R)']
      .map((name, i) => ({ id: `bp${i + 1}`, name })),
    dayTags: ['Travel day', 'Family event', 'Sick', 'Bad sleep', 'Rest day'],
    currencies: ['RM', 'Rp'],
    sleepNightCutoffHour: 12,
    restTimer: { enabled: true, seconds: 90 },
    backupReminderDays: 3,
    createdAt: now,
    updatedAt: now,
  };
}

/** Deep-merge a stored settings row over the defaults so newly added fields always exist. */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  if (!stored) return d;
  const s = stored as Settings;
  return {
    ...d,
    ...s,
    challenge: { ...d.challenge, ...s.challenge },
    targets: Object.fromEntries(
      (Object.keys(d.targets) as (keyof Settings['targets'])[]).map((k) => [k, { ...d.targets[k], ...s.targets?.[k] }]),
    ) as Settings['targets'],
    trackers: { ...d.trackers, ...s.trackers },
    score: { ...d.score, ...s.score, weights: { ...s.score?.weights } },
    restTimer: { ...d.restTimer, ...s.restTimer },
    trainingDays: s.trainingDays?.length === 7 ? s.trainingDays : d.trainingDays,
  };
}
