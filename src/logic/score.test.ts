import { describe, expect, it } from 'vitest';
import { aggregateDays } from './aggregate';
import { headline, labelFor, ruleScore, scoreDay, streak } from './score';
import type { DayScore } from './score';
import { emptySlice, id } from './testutil';
import { defaultSettings } from '../db/defaults';
import type { Drink, Settings } from '../db/types';

const D1 = '2026-10-26'; // Day 1, a Monday
const D2 = '2026-10-27'; // Tuesday
const stamp = { createdAt: 0, updatedAt: 0, tzOffsetMin: -480, time: 0 };
const water = (dayKey: string, ml: number): Drink => ({ id: id(), ...stamp, dayKey, kind: 'water', ml });
const sc = (s: Settings, slice = emptySlice(s), key = D1, today = '2026-11-18') => scoreDay(aggregateDays(slice, [key])[key], s, today);

describe('ruleScore directions', () => {
  it('atLeast: min(1, a/t)', () => {
    expect(ruleScore(1500, { direction: 'atLeast', value: 3000 })).toBe(0.5);
    expect(ruleScore(4000, { direction: 'atLeast', value: 3000 })).toBe(1);
  });
  it('atMost: 1 under, linear loss over', () => {
    expect(ruleScore(1900, { direction: 'atMost', value: 2000 })).toBe(1);
    expect(ruleScore(2500, { direction: 'atMost', value: 2000 })).toBeCloseTo(0.75);
    expect(ruleScore(4000, { direction: 'atMost', value: 2000 })).toBe(0);
  });
  it('range: 1 inside, linear decay to 0 at 25 % outside', () => {
    const t = { direction: 'range' as const, value: 1800, rangeMax: 2200 };
    expect(ruleScore(2000, t)).toBe(1);
    expect(ruleScore(1800, t)).toBe(1);
    expect(ruleScore(1800 - 225, t)).toBeCloseTo(0.5);
    expect(ruleScore(1800 * 0.75, t)).toBeCloseTo(0);
    expect(ruleScore(2200 * 1.125, t)).toBeCloseTo(0.5);
    expect(ruleScore(5000, t)).toBe(0);
  });
});

describe('day score', () => {
  it('empty day with default settings: only water + check-in participate, both 0', () => {
    const r = sc(defaultSettings());
    expect(r.cats.map((c) => c.cat).sort()).toEqual(['checkin', 'water']);
    expect(r.score).toBe(0);
  });
  it('null when nothing participates', () => {
    const s = defaultSettings();
    s.trackers.water = false; s.trackers.checkin = false; s.trackers.supplements = false;
    expect(sc(s).score).toBeNull();
  });
  it('partial day: water at 50 % and check-in done → 75', () => {
    const slice = emptySlice();
    slice.drinks.push(water(D1, 1500));
    slice.checkins.push({ id: id(), createdAt: 0, updatedAt: 0, dayKey: D1, energy: 5, mood: 5, hunger: 5, stress: 5, soreness: 5, dayRating: 5 });
    expect(sc(slice.settings, slice).score).toBeCloseTo(75);
  });
  it('only plain water counts; another drink does not', () => {
    const slice = emptySlice();
    slice.drinks.push({ ...water(D1, 3000), kind: 'other' });
    expect(sc(slice.settings, slice).cats.find((c) => c.cat === 'water')!.score).toBe(0);
  });
  it('non-training days do not penalise training; training days do', () => {
    const s = defaultSettings();
    s.trainingDays = [true, false, false, false, false, false, false]; // Mondays only
    expect(sc(s, emptySlice(s), D2).cats.some((c) => c.cat === 'training')).toBe(false);
    const mon = sc(s, emptySlice(s), D1);
    expect(mon.cats.find((c) => c.cat === 'training')!.score).toBe(0);
  });
  it('disabled targets are ignored; enabled ones join', () => {
    const s = defaultSettings();
    expect(sc(s).cats.some((c) => c.cat === 'protein')).toBe(false);
    s.targets.protein = { enabled: true, value: 180, direction: 'atLeast', unit: 'g' };
    expect(sc(s).cats.some((c) => c.cat === 'protein')).toBe(true);
  });
  it('user weights are renormalised over participating categories', () => {
    const slice = emptySlice();
    slice.settings.score.weights = { water: 3, checkin: 1, protein: 100 }; // protein not participating → ignored
    slice.drinks.push(water(D1, 1500)); // water 0.5, check-in 0
    expect(sc(slice.settings, slice).score).toBeCloseTo((3 * 0.5 + 0) / 4 * 100);
  });
  it('food category = clean meals / meals per day', () => {
    const s = defaultSettings();
    s.targets.mealsPerDay = { enabled: true, value: 4, direction: 'atLeast', unit: 'meals' };
    const slice = emptySlice(s);
    const mk = (clean: boolean) => ({ id: id(), createdAt: 0, updatedAt: 0, dayKey: D1, time: 0, tzOffsetMin: -480, label: 'x', mode: 'cooked' as const, photoId: 'p', items: [], clean });
    slice.meals.push(mk(true), mk(true), mk(false));
    expect(sc(s, slice).cats.find((c) => c.cat === 'food')!.score).toBeCloseTo(0.5);
  });
  it('sleep: today without a night sleep does not participate; a past day without one scores 0', () => {
    const s = defaultSettings();
    s.targets.sleep = { enabled: true, value: 8, direction: 'atLeast', unit: 'h' };
    expect(sc(s, emptySlice(s), D1, D1).cats.some((c) => c.cat === 'sleep')).toBe(false);
    expect(sc(s, emptySlice(s), D1, D2).cats.find((c) => c.cat === 'sleep')!.score).toBe(0);
  });
  it('custom boolean and numeric trackers', () => {
    const s = defaultSettings();
    s.customTrackers = [
      { id: 'ns', name: 'No sugar', kind: 'boolean' },
      { id: 'st', name: 'Stretching', kind: 'number', unit: 'min', target: { enabled: true, value: 10, direction: 'atLeast', unit: 'min' } },
      { id: 'free', name: 'Free number', kind: 'number' },
    ];
    const slice = emptySlice(s);
    slice.customLogs.push({ id: id(), createdAt: 0, updatedAt: 0, dayKey: D1, trackerId: 'ns', value: true }, { id: id(), createdAt: 0, updatedAt: 0, dayKey: D1, trackerId: 'st', value: 5 });
    const r = sc(s, slice);
    expect(r.cats.find((c) => c.cat === 'custom:ns')!.score).toBe(1);
    expect(r.cats.find((c) => c.cat === 'custom:st')!.score).toBe(0.5);
    expect(r.cats.some((c) => c.cat === 'custom:free')).toBe(false); // numeric with no target cannot be scored
  });
});

describe('labels', () => {
  it('uses the highest label whose min ≤ score; none when undefined', () => {
    const labels = [{ min: 50, label: 'Steady' }, { min: 80, label: 'Locked in' }];
    expect(labelFor(86, labels)).toBe('Locked in');
    expect(labelFor(60, labels)).toBe('Steady');
    expect(labelFor(40, labels)).toBeNull();
    expect(labelFor(90, [])).toBeNull();
  });
});

describe('7-day rolling headline', () => {
  const C = defaultSettings().challenge;
  const mk = (v: number | null): DayScore => ({ score: v, cats: v == null ? [] : [{ cat: 'water', score: v / 100 }] });
  it('at the challenge start the window has fewer than 7 days and no previous window', () => {
    const scores = { '2026-10-26': mk(60), '2026-10-27': mk(80), '2026-10-28': mk(100) };
    const h = headline(scores, '2026-10-28', C);
    expect(h.days).toBe(3);
    expect(h.current).toBeCloseTo(80);
    expect(h.previous).toBeNull();
    expect(h.delta).toBeNull();
    expect(h.today).toBe(100);
    expect(h.byCat.water).toBeCloseTo(80);
  });
  it('compares with the previous 7 days and ignores days before Day 1', () => {
    const scores: Record<string, DayScore> = { '2026-10-25': mk(0) }; // baseline day must be excluded
    const keys = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    keys.forEach((k) => (scores[k] = mk(50)));
    ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].forEach((k) => (scores[k] = mk(70)));
    const h = headline(scores, '2026-11-08', C);
    expect(h.current).toBeCloseTo(70);
    expect(h.previous).toBeCloseTo(50);
    expect(h.delta).toBeCloseTo(20);
  });
  it('days after today are not counted', () => {
    const scores = { '2026-10-26': mk(60), '2026-10-27': mk(100) };
    expect(headline(scores, '2026-10-26', C).current).toBe(60);
  });
});

describe('streak', () => {
  const C = defaultSettings().challenge;
  it('threshold 0 = any logged day; today in progress does not break the run', () => {
    const slice = emptySlice();
    const keys = ['2026-10-26', '2026-10-27', '2026-10-28'];
    slice.drinks.push(water(keys[0], 100), water(keys[1], 100));
    const aggs = aggregateDays(slice, keys);
    expect(streak({}, aggs, keys[2], C, 0)).toBe(2);
    slice.drinks.push(water(keys[2], 100));
    expect(streak({}, aggregateDays(slice, keys), keys[2], C, 0)).toBe(3);
  });
  it('with a threshold the day score must reach it', () => {
    const scores: Record<string, DayScore> = { '2026-10-26': { score: 90, cats: [] }, '2026-10-27': { score: 60, cats: [] }, '2026-10-28': { score: 95, cats: [] } };
    expect(streak(scores, {}, '2026-10-28', C, 80)).toBe(1);
  });
});
