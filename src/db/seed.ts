/**
 * Hidden dev seed (Settings → About). Fills ~10 days of realistic demo data so every screen can be checked.
 * The challenge dates are shifted so that TODAY is Day 10; "Wipe all data" restores the real dates.
 */
import { db } from './schema';
import { defaultSettings } from './defaults';
import { newRec, setMeta, todayKey, tzNow, uid } from './ops';
import { compressImage } from './photos';
import { loadRefFoods } from './refdb';
import { addDays, dayKey as dayKeyOf, epochFor, sleepDayKey, weekdayMon0 } from '../logic/dates';
import type * as T from './types';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function fakePhoto(kind: T.BlobRec['kind'], hue: number, label: string, portrait = false): Promise<string> {
  const c = document.createElement('canvas');
  c.width = portrait ? 480 : 640; c.height = portrait ? 640 : 480;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, `hsl(${hue},55%,28%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},60%,45%)`);
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,255,255,0.85)';
  if (portrait) { x.beginPath(); x.arc(240, 160, 60, 0, 7); x.fill(); x.fillRect(170, 230, 140, 260); }
  else { x.beginPath(); x.arc(320, 240, 150, 0, 7); x.fill(); x.fillStyle = `hsl(${hue},70%,55%)`; x.beginPath(); x.arc(290, 220, 50, 0, 7); x.arc(360, 260, 40, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = '600 28px system-ui'; x.fillText(label, 18, c.height - 22);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
  const [full, thumb] = await Promise.all([compressImage(blob, 1280, 0.75), compressImage(blob, 320, 0.7)]);
  const rec = newRec({ kind, full, thumb, takenAt: Date.now() }, true) as T.BlobRec;
  await db.blobs.put(rec);
  return rec.id;
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  await db.settings.put(defaultSettings());
}

export async function loadDemoData(): Promise<void> {
  const rand = rng(21);
  const tz = tzNow();
  const now = Date.now();
  const today = todayKey();
  const D = (n: number) => addDays(today, n - 10); // Day n (Day 10 = today)
  const at = (day: string, hhmm: string) => epochFor(day, hhmm, tz);
  const jitter = (min: number, spread: number) => Math.round(min + (rand() - 0.5) * 2 * spread);
  const hhmm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  await wipeAll();

  /* ---- settings ---- */
  const s = defaultSettings();
  s.challenge = { name: '21 by 21', baselineDate: D(0), startDate: D(1), endDate: D(24), recapDate: D(25), weighInDates: [D(0), D(7), D(14), D(24)], measurementDates: [D(0), D(24)], progressPhotoDates: [D(0), D(24)] };
  s.targets.calories = { enabled: true, value: 2200, direction: 'atMost', unit: 'kcal' };
  s.targets.protein = { enabled: true, value: 170, direction: 'atLeast', unit: 'g' };
  s.targets.sleep = { enabled: true, value: 7, direction: 'atLeast', unit: 'h' };
  s.targets.steps = { enabled: true, value: 8000, direction: 'atLeast', unit: 'steps' };
  s.targets.mealsPerDay = { enabled: true, value: 3, direction: 'atLeast', unit: 'meals' };
  s.trainingDays = [true, true, true, true, true, false, false];
  s.score.labels = [{ min: 50, label: 'Steady' }, { min: 80, label: 'Locked in' }];
  s.quickWater = [{ id: uid(), label: 'Glass', ml: 250 }, { id: uid(), label: 'Bottle', ml: 500 }, { id: uid(), label: 'Big bottle', ml: 750 }];
  s.customTrackers = [{ id: 'nosugar', name: 'No sugar', kind: 'boolean' }];
  await db.settings.put(s);

  /* ---- library ---- */
  const ref = await loadRefFoods().catch(() => []);
  const pickRef = async (name: string, fallback: Partial<T.Nutrients> = {}): Promise<T.Food> => {
    const r = ref.find((x) => x.name === name);
    const f = r
      ? (newRec({ name: r.name, basis: r.basis, per100: r.per100, defaultState: r.state, source: r.source, refId: r.id, useCount: 3, lastUsedAt: now - rand() * 86400000 }) as T.Food)
      : (newRec({ name, basis: 'g' as const, per100: { kcal: 100, protein: 5, carbs: 10, fat: 3, ...fallback }, source: 'user' as const, useCount: 1, lastUsedAt: now }) as T.Food);
    await db.foods.put(f);
    return f;
  };
  const F = {
    oats: await pickRef('Oats, rolled, dry'), banana: await pickRef('Banana'), egg: await pickRef('Egg, whole, boiled'), milk: await pickRef('Milk, low fat (1%)'),
    chicken: await pickRef('Chicken breast, raw'), rice: await pickRef('White rice, cooked'), broccoli: await pickRef('Broccoli, raw'), oil: await pickRef('Olive oil'),
    soy: await pickRef('Soy sauce'), salmon: await pickRef('Salmon, cooked'), sweet: await pickRef('Sweet potato, boiled'), spinach: await pickRef('Spinach, raw'),
    ayam: await pickRef('Ayam bakar'), nasi: await pickRef('Nasi putih (steamed rice)'), lalap: await pickRef('Lalapan (raw vegetable mix)'), sambal: await pickRef('Sambal ijo'),
    nasgor: await pickRef('Nasi goreng'), yogurt: await pickRef('Greek yogurt, plain nonfat'), pb: await pickRef('Peanut butter'), garlic: await pickRef('Garlic, raw'),
  };
  const creatine = newRec({ name: 'Creatine', defaultAmount: 5, unit: 'g', timingTag: 'Morning', daily: true }) as T.Supplement;
  const fishOil = newRec({ name: 'Fish oil', defaultAmount: 2, unit: 'capsule', timingTag: 'With dinner', daily: true }) as T.Supplement;
  const whey = newRec({ name: 'Whey', brand: 'Generic', defaultAmount: 30, unit: 'g', timingTag: 'After gym', daily: false, perServing: { kcal: 120, protein: 24, carbs: 3, fat: 1.5 } }) as T.Supplement;
  await db.supplements.bulkPut([creatine, fishOil, whey]);
  const coffee = newRec({ name: 'Black coffee', per100ml: { kcal: 1, protein: 0.1, carbs: 0, fat: 0 } }) as T.DrinkType;
  const latte = newRec({ name: 'Latte', per100ml: { kcal: 50, protein: 3, carbs: 5, fat: 2 } }) as T.DrinkType;
  await db.drinkTypes.bulkPut([coffee, latte]);

  const ex = (name: string, muscleGroups: string[], kind: 'strength' | 'cardio' = 'strength') => newRec({ name, muscleGroups, kind }) as T.Exercise;
  const E = {
    bench: ex('Bench Press', ['Chest', 'Triceps']), ohp: ex('Overhead Press', ['Shoulders', 'Triceps']), pushdown: ex('Triceps Pushdown', ['Triceps']),
    row: ex('Barbell Row', ['Back', 'Biceps']), pulldown: ex('Lat Pulldown', ['Back']), curl: ex('Biceps Curl', ['Biceps']),
    squat: ex('Squat', ['Quads', 'Glutes']), legpress: ex('Leg Press', ['Quads']), rdl: ex('Romanian Deadlift', ['Hamstrings', 'Glutes', 'Back']),
    calf: ex('Calf Raise', ['Calves']), treadmill: ex('Treadmill', ['Cardio'], 'cardio'),
  };
  await db.exercises.bulkPut(Object.values(E));
  const gym1 = newRec({ name: 'Solo Fitness', note: 'Main gym', equipment: ['Barbells', 'Dumbbells', 'Cables', 'Squat rack', 'Treadmill'], lat: -7.5666, lng: 110.8167 }) as T.Gym;
  const gym2 = newRec({ name: 'KL Gym', equipment: ['Dumbbells', 'Machines'], lat: 3.139, lng: 101.6869 }) as T.Gym;
  await db.gyms.bulkPut([gym1, gym2]);

  /* ---- baseline (Day 0) ---- */
  const d0 = D(0);
  await db.weighIns.put(newRec({ dayKey: d0, time: at(d0, '07:10'), tzOffsetMin: tz, kg: 98.6 }, true) as T.WeighIn);
  await db.weighIns.put(newRec({ dayKey: D(7), time: at(D(7), '07:05'), tzOffsetMin: tz, kg: 97.4 }, true) as T.WeighIn);
  const base: Record<string, number> = { Neck: 42.5, Shoulders: 121, Chest: 113, 'Arm (L)': 38, 'Arm (R)': 38.5, Waist: 104, Hips: 110, 'Thigh (L)': 66, 'Thigh (R)': 66.5, 'Calf (L)': 40, 'Calf (R)': 40 };
  await db.measurements.put(newRec({ dayKey: d0, values: Object.fromEntries(s.bodyParts.map((b) => [b.id, base[b.name] ?? 50])) }, true) as T.Measurement);
  for (const [i, pose] of (['front', 'side', 'back'] as const).entries())
    await db.progressPhotos.put(newRec({ dayKey: d0, pose, blobId: await fakePhoto('progress', 200 + i * 20, `Day 0 · ${pose}`, true) }, true) as T.ProgressPhoto);

  /* ---- per day ---- */
  const item = (f: T.Food, amount: number, o: Partial<T.MealItem> = {}): T.MealItem => ({
    id: uid(), foodId: f.id, name: f.name.replace(/, (raw|cooked)$/i, ''), amount, basis: f.basis, per100: f.per100, source: f.source,
    estimated: false, isSeasoning: false, state: f.defaultState, ...o,
  });
  const meals: T.Meal[] = [];
  const addMeal = async (day: string, time: number, label: string, mode: 'bought' | 'cooked', items: T.MealItem[], o: Partial<T.Meal> = {}) => {
    const photoId = await fakePhoto('meal', Math.round(rand() * 360), `${label} · ${mode}`);
    meals.push(newRec({ dayKey: day, time, tzOffsetMin: tz, label, mode, photoId, items, clean: true, ...o }, true) as T.Meal);
  };
  const workouts: T.Workout[] = [];
  const sleeps: T.Sleep[] = [];
  const drinks: T.Drink[] = [];
  const suppLogs: T.SupplementLog[] = [];
  const checkins: T.Checkin[] = [];
  const cravings: T.Craving[] = [];
  const steps: T.StepsRec[] = [];
  const customLogs: T.CustomLog[] = [];

  const SESSIONS: { title: string; ex: [T.Exercise, number][] }[] = [
    { title: 'Push', ex: [[E.bench, 70], [E.ohp, 40], [E.pushdown, 30]] },
    { title: 'Pull', ex: [[E.row, 60], [E.pulldown, 55], [E.curl, 15]] },
    { title: 'Legs', ex: [[E.squat, 90], [E.legpress, 160], [E.calf, 60]] },
    { title: 'Push', ex: [[E.bench, 70], [E.ohp, 40], [E.pushdown, 30]] },
    { title: 'Pull', ex: [[E.row, 60], [E.pulldown, 55], [E.rdl, 80]] },
  ];
  const seen: Record<string, number> = {};
  let sessionNo = 0;

  for (let n = 1; n <= 10; n++) {
    const day = D(n);
    const isToday = n === 10;
    const nextDay = addDays(day, 1);
    const wd = weekdayMon0(day);
    const t = (hhmm_: string, fallbackAgoMin?: number) => (isToday && fallbackAgoMin != null ? now - fallbackAgoMin * 60000 : at(day, hhmm_));

    // meals
    const kcalBias = rand();
    await addMeal(day, t('08:00', 400), 'Breakfast', 'cooked', [item(F.oats, 60), item(F.banana, 100), item(F.egg, 110), item(F.milk, 200)], { cookTimeMin: 6, method: 'Boiled' });
    if (n % 2 === 0) {
      await addMeal(day, t('12:30', 240), 'Lunch', 'cooked', [item(F.chicken, 250 + Math.round(kcalBias * 40)), item(F.rice, 180), item(F.broccoli, 120), item(F.oil, 5, { isSeasoning: true }), item(F.soy, 10, { isSeasoning: true }), item(F.garlic, 6, { isSeasoning: true })],
        { method: 'Pan-fried', cookTimeMin: 14, tool: 'Non-stick pan', wholeDishG: 590, eatenG: 590, cost: { amount: 9.4, currency: 'RM' }, note: 'Marinated chicken 20 min in soy + garlic.' });
    } else {
      await addMeal(day, t('12:45', 240), 'Lunch', 'bought', [item(F.ayam, 200, { estimated: true }), item(F.nasi, 150, { estimated: true }), item(F.lalap, 80, { estimated: true }), item(F.sambal, 20, { estimated: true })],
        { place: 'Warung Bu Tini, Solo', price: { amount: 28000, currency: 'Rp' } });
    }
    if (!isToday) {
      if (n % 3 === 0) await addMeal(day, at(day, '19:15'), 'Dinner', 'bought', [item(F.nasgor, 320, { estimated: true })], { place: 'Mamak, KL', price: { amount: 12, currency: 'RM' }, clean: n !== 6 });
      else await addMeal(day, at(day, '19:30'), 'Dinner', 'cooked', [item(F.salmon, 150), item(F.sweet, 200), item(F.spinach, 100), item(F.oil, 5, { isSeasoning: true })], { method: 'Baked', cookTimeMin: 20, tool: 'Oven', cost: { amount: 14.5, currency: 'RM' } });
      if (n % 2 === 1) await addMeal(day, at(day, '16:00'), 'Snack', 'cooked', [item(F.yogurt, 170), item(F.pb, 15)]);
    }

    // water + drinks
    const waterTarget = isToday ? 1800 : 2400 + Math.round(rand() * 1300);
    const todayWater = [[400, 500], [240, 300], [160, 300], [60, 700]];
    if (isToday) for (const [ago, ml] of todayWater) drinks.push(newRec({ dayKey: day, time: now - ago * 60000 - 60000, tzOffsetMin: tz, kind: 'water' as const, ml }, true) as T.Drink);
    else {
      let rem = waterTarget; const hours = [6.75, 10, 12.7, 15, 17.5, 19.9, 21.2];
      for (const h of hours) { if (rem <= 0) break; const ml = Math.min(rem, [300, 500, 400, 600, 500, 400, 300][hours.indexOf(h)]); rem -= ml; drinks.push(newRec({ dayKey: day, time: at(day, hhmm(h * 60)), tzOffsetMin: tz, kind: 'water' as const, ml }, true) as T.Drink); }
      if (rem > 0) drinks.push(newRec({ dayKey: day, time: at(day, '22:00'), tzOffsetMin: tz, kind: 'water' as const, ml: rem }, true) as T.Drink);
    }
    if (n % 2 === 0) drinks.push(newRec({ dayKey: day, time: t('09:30', 360), tzOffsetMin: tz, kind: 'other' as const, drinkTypeId: n % 4 === 0 ? latte.id : coffee.id, ml: 250 }, true) as T.Drink);

    // supplements
    suppLogs.push(newRec({ dayKey: day, time: t('07:02', 430), tzOffsetMin: tz, supplementId: creatine.id, name: 'Creatine', amount: 5, unit: 'g', timingTag: 'Morning' }, true) as T.SupplementLog);
    if (!isToday && n !== 4) suppLogs.push(newRec({ dayKey: day, time: at(day, '19:40'), tzOffsetMin: tz, supplementId: fishOil.id, name: 'Fish oil', amount: 2, unit: 'capsule', timingTag: 'With dinner' }, true) as T.SupplementLog);
    if (!isToday && wd <= 4) suppLogs.push(newRec({ dayKey: day, time: at(day, '18:45'), tzOffsetMin: tz, supplementId: whey.id, name: 'Whey', amount: 30, unit: 'g', timingTag: 'After gym' }, true) as T.SupplementLog);

    // sleep (night starting the evening of this day; the night of Day 9 ends this morning)
    if (n <= 9) {
      const bedMin = 23 * 60 + jitter(10, 55);
      const start = at(day, hhmm(bedMin)) + (bedMin >= 1440 ? 86400000 : 0);
      const dur = jitter(7 * 60 + 10, 45);
      const end = start + dur * 60000;
      sleeps.push(newRec({ kind: 'night' as const, start, end, tzOffsetMin: tz, endTzOffsetMin: tz, durationMin: dur, dayKey: sleepDayKey('night', start, tz, 12) }, true) as T.Sleep);
    }
    if ([3, 6, 8].includes(n)) {
      const start = at(day, '14:00');
      sleeps.push(newRec({ kind: 'nap' as const, start, end: start + 25 * 60000, tzOffsetMin: tz, endTzOffsetMin: tz, durationMin: 25, dayKey: day }, true) as T.Sleep);
    }

    // training
    if (wd <= 4) {
      const tpl = SESSIONS[sessionNo % SESSIONS.length]; sessionNo += 1;
      const checkIn = isToday ? now - 75 * 60000 : at(day, hhmm(17 * 60 + 30 + jitter(0, 30)));
      const sets: T.WorkoutSet[] = [];
      let o = 0;
      for (const [exercise, w0] of tpl.ex) {
        const times = (seen[exercise.id] ?? 0); seen[exercise.id] = times + 1;
        const w = Math.round((w0 + times * 2.5) / 2.5) * 2.5;
        sets.push({ id: uid(), exerciseId: exercise.id, order: o++, weightKg: Math.round(w * 0.6 / 2.5) * 2.5, reps: 10, isWarmup: true, doneAt: checkIn + o * 240000 });
        const reps = [10, 9, 8, 8];
        for (let k = 0; k < 3 + (times % 2); k++) sets.push({ id: uid(), exerciseId: exercise.id, order: o++, weightKg: w, reps: reps[k] - (rand() < 0.2 ? 1 : 0), doneAt: checkIn + o * 240000 });
      }
      const cardio: T.CardioEntry[] = n % 3 === 0 ? [{ id: uid(), exerciseId: E.treadmill.id, durationMin: 15, speedKmh: 6, inclinePct: 3, distanceKm: 1.5, kcal: 140 }] : [];
      const dur = 55 + Math.round(rand() * 20);
      workouts.push(newRec({
        dayKey: day, checkIn, checkOut: isToday ? now - 10 * 60000 : checkIn + dur * 60000, tzOffsetMin: tz, gymId: n === 5 ? gym2.id : gym1.id, title: tpl.title,
        rating: 7 + Math.round(rand() * 2), sets, cardio, exerciseIds: [...new Set([...sets.map((x) => x.exerciseId), ...cardio.map((c) => c.exerciseId)])],
      }, true) as T.Workout);
    }

    // check-in, craving, steps, custom tracker
    if (!isToday) {
      const r10 = (lo: number, hi: number) => Math.min(10, Math.max(1, Math.round(lo + rand() * (hi - lo))));
      checkins.push(newRec({ dayKey: day, energy: r10(5, 9), mood: r10(6, 9), hunger: r10(3, 7), stress: r10(2, 6), soreness: r10(2, 7), dayRating: r10(6, 9), note: n === 6 ? 'Slow morning, better after lunch.' : undefined }, true) as T.Checkin);
      if (n !== 4) steps.push(newRec({ dayKey: day, steps: 6500 + Math.round(rand() * 6000) }, true) as T.StepsRec);
    }
    if (n % 2 === 1 || isToday) cravings.push(newRec({ dayKey: day, time: t(rand() < 0.5 ? '15:10' : '21:20', 200), tzOffsetMin: tz, what: n % 3 === 0 ? 'fried snacks' : 'chocolate', strength: 5 + Math.round(rand() * 4), outcome: n === 5 ? 'ate' as const : 'resisted' as const }, true) as T.Craving);
    if (!isToday) customLogs.push(newRec({ dayKey: day, trackerId: 'nosugar', value: n !== 6 }, true) as T.CustomLog);
    void nextDay;
  }

  const idFor = (table: string, day: string) => `${table}:${day}`;
  await db.meals.bulkPut(meals);
  await db.drinks.bulkPut(drinks);
  await db.supplementLogs.bulkPut(suppLogs);
  await db.sleeps.bulkPut(sleeps);
  await db.workouts.bulkPut(workouts);
  await db.checkins.bulkPut(checkins.map((c) => ({ ...c, id: idFor('checkin', c.dayKey) })));
  await db.cravings.bulkPut(cravings);
  await db.steps.bulkPut(steps.map((c) => ({ ...c, id: idFor('steps', c.dayKey) })));
  await db.customLogs.bulkPut(customLogs.map((c) => ({ ...c, id: `${c.trackerId}:${c.dayKey}` })));
  await db.soreness.bulkPut([2, 3, 6, 9].map((n) => ({ ...(newRec({ dayKey: D(n), muscles: (n === 3 ? { Quads: 3, Glutes: 2, Calves: 1 } : n === 2 ? { Chest: 2, Shoulders: 1, Triceps: 2 } : { Back: 2, Biceps: 1 }) as Record<string, 0 | 1 | 2 | 3> }, true) as T.SorenessRec), id: idFor('soreness', D(n)) })));
  await db.dayTags.put({ ...(newRec({ dayKey: D(6), tags: ['Family event'] }, true) as T.DayTagRec), id: idFor('dayTags', D(6)) });
  await db.dayNotes.put({ ...(newRec({ dayKey: D(5), text: 'Trained at the KL gym. Felt strong on bench.' }, true) as T.DayNote), id: idFor('dayNotes', D(5)) });
  await db.reminders.bulkPut([
    newRec({ text: 'Buy chicken breast & broccoli', at: now + 3 * 3600000, done: false, tzOffsetMin: tz }, true) as T.Reminder,
  ]);
  await setMeta('onboarded', true);
  void dayKeyOf;
}
