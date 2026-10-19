import { describe, expect, it } from 'vitest';
import { buildPairs, cravingsByHour, eatingWindowMin, METRICS, muscleSplit, overnightGapMin, pearson, sd, sleepClock, spendByCurrency, trend7, weightSegments } from './stats';
import { aggregateDays } from './aggregate';
import { emptySlice, id, meal, set, workout } from './testutil';
import { epochFor } from './dates';
import type { Exercise, Sleep, WeighIn } from '../db/types';

const MY = -480;
const base = { createdAt: 0, updatedAt: 0 };

describe('stats helpers', () => {
  it('pearson r', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
  it('population standard deviation', () => expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2));
  it('7-day trend compares the last 7 with the 7 before', () => {
    const v = [...Array(7).fill(10), ...Array(7).fill(13)];
    expect(trend7(v)).toEqual({ cur: 13, prev: 10, delta: 3 });
    expect(trend7([1, 2, 3]).delta).toBeNull();
  });
  it('eating window and overnight gap', () => {
    const at = (h: number, m = 0) => ({ time: epochFor('2026-11-02', `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, MY) });
    expect(eatingWindowMin([at(8), at(12, 30), at(19)])).toBe(11 * 60);
    expect(eatingWindowMin([at(8)])).toBeNull();
    const yest = { time: epochFor('2026-11-01', '20:00', MY) };
    expect(overnightGapMin([yest], [at(8)])).toBe(12 * 60);
    expect(overnightGapMin([], [at(8)])).toBeNull();
  });
  it('spend is summed per currency and never converted', () => {
    const meals = [
      meal('2026-11-02', [], { mode: 'bought', price: { amount: 28000, currency: 'Rp' } }),
      meal('2026-11-02', [], { mode: 'bought', price: { amount: 12, currency: 'RM' } }),
      meal('2026-11-03', [], { mode: 'cooked', cost: { amount: 9.4, currency: 'RM' } }),
    ];
    const r = spendByCurrency(meals);
    expect(r.Rp).toEqual({ total: 28000, cooked: 0, bought: 28000 });
    expect(r.RM.total).toBeCloseTo(21.4);
    expect(r.RM.cooked).toBeCloseTo(9.4);
  });
  it('cravings histogram uses the logged wall-clock hour', () => {
    const c = (h: number) => ({ ...base, id: id(), dayKey: 'x', time: epochFor('2026-11-02', `${h}:00`, MY), tzOffsetMin: MY, what: 'x', strength: 5, outcome: 'resisted' as const });
    const h = cravingsByHour([c(15), c(15), c(21)]);
    expect(h[15]).toBe(2);
    expect(h[21]).toBe(1);
    expect(h.reduce((a, b) => a + b)).toBe(3);
  });
  it('muscle-group volume is credited to every group of the exercise, divided equally', () => {
    const ex: Exercise[] = [
      { ...base, id: 'bench', name: 'Bench', muscleGroups: ['Chest', 'Triceps'], kind: 'strength' },
      { ...base, id: 'squat', name: 'Squat', muscleGroups: ['Quads'], kind: 'strength' },
    ];
    const w = workout('2026-11-02', 1, [set('bench', 100, 10), set('squat', 100, 10, 1)]); // 1000 each
    const r = muscleSplit([w], ex);
    expect(r.find((x) => x.group === 'Chest')!.volume).toBe(500);
    expect(r.find((x) => x.group === 'Triceps')!.volume).toBe(500);
    expect(r.find((x) => x.group === 'Quads')!.pct).toBeCloseTo(50);
  });
  it('weight segments use real dates for the per-week rate', () => {
    const w = (dayKey: string, kg: number): WeighIn => ({ ...base, id: id(), dayKey, time: 0, tzOffsetMin: MY, kg });
    const seg = weightSegments([w('2026-11-08', 96.5), w('2026-10-25', 98.6), w('2026-11-01', 97.4), w('2026-11-18', 95.1)]);
    expect(seg).toHaveLength(3);
    expect(seg[0].delta).toBeCloseTo(-1.2);
    expect(seg[0].perWeek).toBeCloseTo(-1.2);
    expect(seg[2].days).toBe(10);
    expect(seg[2].perWeek).toBeCloseTo((-1.4 / 10) * 7);
  });
  it('bedtime / wake average with spread handles midnight', () => {
    const night = (start: string, end: string): Sleep => ({ ...base, id: id(), kind: 'night', dayKey: 'x', tzOffsetMin: MY, start: epochFor(start.slice(0, 10), start.slice(11), MY), end: epochFor(end.slice(0, 10), end.slice(11), MY) });
    const r = sleepClock([night('2026-11-01 23:30', '2026-11-02 07:00'), night('2026-11-02 00:30', '2026-11-02 07:00')]);
    expect(r.bed!.mean).toBeCloseTo(0); // 23:30 → −30, 00:30 → +30
    expect(r.bed!.sd).toBeCloseTo(30);
    expect(r.wake!.mean).toBeCloseTo(7 * 60);
    expect(sleepClock([]).bed).toBeNull();
  });
  it('correlation pairs, with the "next day" lag', () => {
    const slice = emptySlice();
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
    const checkin = (dayKey: string, energy: number) => ({ ...base, id: id(), dayKey, energy, mood: 5, hunger: 5, stress: 5, soreness: 5, dayRating: 5 });
    slice.checkins = [checkin(days[0], 3), checkin(days[1], 6), checkin(days[2], 9)];
    slice.drinks = days.map((dayKey, i) => ({ ...base, id: id(), dayKey, time: 0, tzOffsetMin: MY, kind: 'water' as const, ml: 1000 * (i + 1) }));
    const aggs = aggregateDays(slice, [...days, '2026-11-04']);
    const m = (k: string) => METRICS.find((x) => x.id === k)!;
    const same = buildPairs(days, aggs, {}, m('water'), m('energy'), false);
    expect(same.map((p) => [p.x, p.y])).toEqual([[1000, 3], [2000, 6], [3000, 9]]);
    const lag = buildPairs(days, aggs, {}, m('water'), m('energy'), true);
    expect(lag.map((p) => [p.x, p.y])).toEqual([[1000, 6], [2000, 9]]); // last day has no next day
  });
});
