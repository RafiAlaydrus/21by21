import { describe, expect, it } from 'vitest';
import { matches, norm, searchAll } from './search';
import { buildReport } from './report';
import { aggregateDays } from './aggregate';
import { buildTimeline } from './timeline';
import { computePRs } from './prs';
import { emptySlice, id, item, meal, per100, set, workout } from './testutil';
import type { Craving, DayNote, Drink } from '../db/types';

describe('search', () => {
  it('is case- and diacritics-insensitive substring matching', () => {
    expect(norm('Crème Brûlée')).toBe('creme brulee');
    expect(matches('CREME', 'Crème brûlée')).toBe(true);
    expect(matches('xyz', 'abc', undefined, null)).toBe(false);
    expect(matches('  ', 'abc')).toBe(false);
  });
  it('finds meals by item, place or note; cravings; notes', () => {
    const m = meal('2026-11-02', [{ ...item(100, per100(100)), name: 'Ayam bakar' }], { place: 'Warung Solo', note: 'extra sambal' });
    const crave: Craving = { id: id(), createdAt: 0, updatedAt: 0, dayKey: '2026-11-02', time: 0, tzOffsetMin: -480, what: 'Chocolate', strength: 5, outcome: 'resisted' };
    const note: DayNote = { id: id(), createdAt: 0, updatedAt: 0, dayKey: '2026-11-03', text: 'Slept badly' };
    const d = { meals: [m], foods: [], recipes: [], exercises: [], workouts: [], cravings: [crave], dayNotes: [note], dayTags: [], reminders: [], checkins: [] };
    expect(searchAll('AYAM', d).map((h) => h.kind)).toEqual(['meal']);
    expect(searchAll('solo', d)).toHaveLength(1);
    expect(searchAll('sambal', d)).toHaveLength(1);
    expect(searchAll('choc', d)[0].kind).toBe('craving');
    expect(searchAll('badly', d)[0].dayKey).toBe('2026-11-03');
    expect(searchAll('', d)).toEqual([]);
  });
});

describe('report + timeline', () => {
  const slice = () => {
    const s = emptySlice();
    const w1 = workout('2026-11-02', Date.UTC(2026, 10, 2, 9), [set('bench', 70, 8)], { checkOut: Date.UTC(2026, 10, 2, 10) });
    const w2 = workout('2026-11-03', Date.UTC(2026, 10, 3, 9), [set('bench', 80, 8)], { checkOut: Date.UTC(2026, 10, 3, 10) });
    s.workouts = [w1, w2];
    s.meals = [meal('2026-11-02', [item(200, per100(120, 22, 0, 3))])];
    s.drinks = [{ id: id(), createdAt: 0, updatedAt: 0, dayKey: '2026-11-02', time: Date.UTC(2026, 10, 2, 5), tzOffsetMin: -480, kind: 'water', ml: 500 } as Drink];
    return { ...s, exercises: [{ id: 'bench', createdAt: 0, updatedAt: 0, name: 'Bench Press', muscleGroups: ['Chest'], kind: 'strength' as const }] };
  };
  it('produces a plain-text per-day report with totals and no advice', () => {
    const md = buildReport(slice(), '2026-11-02', '2026-11-04', '2026-11-04');
    expect(md).toContain('## Range summary');
    expect(md).toContain('Bench Press');
    expect(md).toContain('nothing logged');
    expect(md).toMatch(/240 kcal/);
    expect(md).not.toMatch(/\b(should|try to|aim|recommend|great job)\b/i);
  });
  it('timeline is time-ordered and carries each entry its own logged offset', () => {
    const s = slice();
    const a = aggregateDays(s, ['2026-11-02'])['2026-11-02'];
    const ev = buildTimeline({ ...s, reminders: [], dayNotes: [] , drinkTypes: [] }, '2026-11-02', a, computePRs(s.workouts), -480);
    expect(ev.map((e) => e.kind)).toEqual(['water', 'workout', 'meal']);
    expect(ev.every((e, i) => i === 0 || ev[i - 1].time <= e.time)).toBe(true);
    expect(ev[0].tz).toBe(-480);
  });
});
