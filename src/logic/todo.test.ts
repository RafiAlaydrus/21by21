import { describe, expect, it } from 'vitest';
import { aggregateDays } from './aggregate';
import { stillToLog } from './todo';
import { emptySlice, id, meal } from './testutil';
import { defaultSettings } from '../db/defaults';
import type { Drink, Supplement } from '../db/types';

const K = '2026-11-02'; // Monday
const supp = (name: string, daily = true): Supplement => ({ id: id(), createdAt: 0, updatedAt: 0, name, defaultAmount: 5, unit: 'g', daily });
const ctx = { hasMeasurement: false, hasPhotos: false };

describe('still to log today', () => {
  it('lists water, missing meal, supplements, training, check-in in order', () => {
    const s = defaultSettings();
    s.targets.mealsPerDay = { enabled: true, value: 3, direction: 'atLeast', unit: 'meals' };
    s.trainingDays = [true, true, true, true, true, false, false];
    const slice = emptySlice(s);
    const fish = supp('Fish oil'), cre = supp('Creatine'), optional = supp('Optional', false);
    slice.supplements = [fish, cre, optional];
    slice.meals = [meal(K, [], { label: 'Breakfast' }), meal(K, [], { label: 'Lunch' })];
    const drink: Drink = { id: id(), createdAt: 0, updatedAt: 0, dayKey: K, time: 0, tzOffsetMin: -480, kind: 'water', ml: 1800 };
    slice.drinks = [drink];
    slice.supplementLogs = [{ id: id(), createdAt: 0, updatedAt: 0, dayKey: K, time: 0, tzOffsetMin: -480, supplementId: cre.id, name: 'Creatine', amount: 5, unit: 'g' }];
    const a = aggregateDays(slice, [K])[K];
    const items = stillToLog(a, s, slice.supplements, ctx);
    expect(items.map((i) => i.label)).toEqual(['Water', 'Dinner not logged', 'Fish oil not logged', 'Training not logged', 'Daily check-in']);
    expect(items[0].progress).toEqual({ value: 1800, target: 3000, unit: 'ml' });
    expect(items[2].supplementId).toBe(fish.id);
  });
  it('is empty when everything is done', () => {
    const s = defaultSettings();
    s.trackers.checkin = false;
    const slice = emptySlice(s);
    slice.drinks = [{ id: id(), createdAt: 0, updatedAt: 0, dayKey: K, time: 0, tzOffsetMin: -480, kind: 'water', ml: 3000 }];
    expect(stillToLog(aggregateDays(slice, [K])[K], s, [], ctx)).toEqual([]);
  });
  it('adds weigh-in / measurements / photos only on their scheduled dates', () => {
    const s = defaultSettings();
    s.trackers.checkin = false; s.trackers.water = false;
    const slice = emptySlice(s);
    const a = aggregateDays(slice, ['2026-11-01', K])['2026-11-01'];
    const labels = stillToLog(a, s, [], ctx).map((i) => i.label);
    expect(labels).toEqual(['Weigh-in']);
    const b = aggregateDays(slice, ['2026-11-18'])['2026-11-18'];
    expect(stillToLog(b, s, [], ctx).map((i) => i.label)).toEqual(['Weigh-in', 'Measurements', 'Progress photos']);
    expect(stillToLog(b, s, [], { hasMeasurement: true, hasPhotos: true }).map((i) => i.label)).toEqual(['Weigh-in']);
  });
  it('ignores disabled trackers', () => {
    const s = defaultSettings();
    s.trackers.water = false; s.trackers.checkin = false;
    expect(stillToLog(aggregateDays(emptySlice(s), [K])[K], s, [], ctx)).toEqual([]);
  });
});
