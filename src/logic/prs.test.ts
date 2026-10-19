import { describe, expect, it } from 'vitest';
import { computePRs, epley, prCountForWorkout, prSetIds } from './prs';
import { set, workout } from './testutil';

const day = (n: number) => Date.UTC(2026, 9, 26 + n, 10);
const key = (n: number) => `2026-10-${26 + n}`;

describe('personal records', () => {
  it('the first time an exercise is done is the baseline, not a PR', () => {
    const w = workout(key(0), day(0), [set('bench', 60, 8, 0), set('bench', 70, 5, 1)]);
    expect(computePRs([w])).toEqual([]);
  });
  it('heavier weight, better e1RM and set volume are flagged against the earlier session', () => {
    const w1 = workout(key(0), day(0), [set('bench', 70, 8)]);
    const s = set('bench', 80, 8);
    const w2 = workout(key(1), day(1), [s]);
    const ev = computePRs([w1, w2]);
    const types = ev.map((e) => e.type).sort();
    expect(types).toEqual(['e1rm', 'sessionVolume', 'setVolume', 'weight']);
    expect(ev.find((e) => e.type === 'weight')).toMatchObject({ value: 80, prev: 70, setId: s.id });
    expect(prSetIds(ev).has(s.id)).toBe(true);
    expect(prCountForWorkout(ev, w2.id)).toBe(1); // one exercise
  });
  it('most reps at a given weight', () => {
    const w1 = workout(key(0), day(0), [set('row', 60, 8)]);
    const w2 = workout(key(1), day(1), [set('row', 60, 10)]);
    expect(computePRs([w1, w2]).some((e) => e.type === 'reps' && e.value === 10 && e.prev === 8)).toBe(true);
  });
  it('warm-up sets and sets not marked done never count', () => {
    const w1 = workout(key(0), day(0), [set('squat', 100, 5)]);
    const w2 = workout(key(1), day(1), [set('squat', 140, 5, 0, { isWarmup: true }), set('squat', 150, 5, 1, { doneAt: undefined })]);
    expect(computePRs([w1, w2])).toEqual([]);
  });
  it('counts distinct exercises per session, and is order independent', () => {
    const w1 = workout(key(0), day(0), [set('a', 50, 5), set('b', 50, 5)]);
    const w2 = workout(key(1), day(1), [set('a', 55, 5), set('b', 55, 5, 1), set('b', 60, 5, 2)]);
    const ev = computePRs([w2, w1]);
    expect(prCountForWorkout(ev, w2.id)).toBe(2);
  });
  it('a lower session afterwards is not a PR', () => {
    const w1 = workout(key(0), day(0), [set('a', 80, 5)]);
    const w2 = workout(key(1), day(1), [set('a', 90, 5)]);
    const w3 = workout(key(2), day(2), [set('a', 85, 5)]);
    expect(prCountForWorkout(computePRs([w1, w2, w3]), w3.id)).toBe(0);
  });
  it('Epley 1RM', () => expect(epley(100, 5)).toBeCloseTo(116.667, 2));
});
