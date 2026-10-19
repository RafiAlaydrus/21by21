import { describe, expect, it } from 'vitest';
import { addDays, challengeDay, challengeLength, challengePhase, dayKey, daysLeft, diffDays, epochFor, fmtTime, sleepDayKey, weekStart, weekdayMon0 } from './dates';
import { defaultSettings } from '../db/defaults';

const C = defaultSettings().challenge;
const MY = -480; // Malaysia UTC+8
const ID = -420; // Indonesia (WIB) UTC+7

describe('dayKey / timezones', () => {
  it('computes the local day in the given offset', () => {
    const t = Date.UTC(2026, 10, 1, 17, 30); // 01:30 on 2 Nov in UTC+8, 00:30 in UTC+7
    expect(dayKey(t, MY)).toBe('2026-11-02');
    expect(dayKey(t, ID)).toBe('2026-11-02');
    const t2 = Date.UTC(2026, 10, 1, 16, 30); // 00:30 on 2 Nov in UTC+8, 23:30 on 1 Nov in UTC+7
    expect(dayKey(t2, MY)).toBe('2026-11-02');
    expect(dayKey(t2, ID)).toBe('2026-11-01');
  });
  it('a stored entry keeps its wall-clock time regardless of the phone zone later', () => {
    const logged = Date.UTC(2026, 10, 2, 4, 5); // 12:05 in UTC+8
    expect(fmtTime(logged, MY)).toBe('12:05');
    expect(fmtTime(logged, ID)).toBe('11:05'); // what a naive re-render in the new zone would (wrongly) show
    const stored = { dayKey: dayKey(logged, MY), tzOffsetMin: MY };
    expect(stored.dayKey).toBe('2026-11-02'); // frozen at log time
    expect(fmtTime(logged, stored.tzOffsetMin)).toBe('12:05');
  });
  it('epochFor is the inverse of fmtTime/dayKey', () => {
    const t = epochFor('2026-11-02', '23:42', MY);
    expect(dayKey(t, MY)).toBe('2026-11-02');
    expect(fmtTime(t, MY)).toBe('23:42');
  });
});

describe('day arithmetic', () => {
  it('adds, diffs, weekdays', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-26', '2026-11-18')).toBe(23);
    expect(weekdayMon0('2026-10-26')).toBe(0); // Day 1 is a Monday
    expect(weekdayMon0('2026-10-25')).toBe(6);
    expect(weekStart('2026-11-04')).toBe('2026-11-02');
  });
});

describe('challenge', () => {
  it('numbers the days', () => {
    expect(challengeDay('2026-10-25', C)).toBe(0);
    expect(challengeDay('2026-10-26', C)).toBe(1);
    expect(challengeDay('2026-11-02', C)).toBe(8);
    expect(challengeDay('2026-11-18', C)).toBe(24);
    expect(challengeDay('2026-11-19', C)).toBeNull();
    expect(challengeDay('2026-10-24', C)).toBeNull();
    expect(challengeLength(C)).toBe(24);
  });
  it('days left matches the design (Day 8 → 16)', () => {
    expect(daysLeft('2026-11-02', C)).toBe(16);
    expect(daysLeft('2026-11-18', C)).toBe(0);
    expect(daysLeft('2026-11-25', C)).toBe(0);
  });
  it('phases', () => {
    expect(challengePhase('2026-10-20', C)).toBe('before');
    expect(challengePhase('2026-10-25', C)).toBe('baseline');
    expect(challengePhase('2026-10-26', C)).toBe('active');
    expect(challengePhase('2026-11-19', C)).toBe('complete');
  });
});

describe('sleep attribution (12:00 cut-off)', () => {
  it('night sleep started 01:30 on 2 Nov belongs to 1 Nov', () => {
    expect(sleepDayKey('night', Date.UTC(2026, 10, 1, 17, 30), MY, 12)).toBe('2026-11-01');
  });
  it('night sleep started 23:42 on 1 Nov belongs to 1 Nov', () => {
    expect(sleepDayKey('night', epochFor('2026-11-01', '23:42', MY), MY, 12)).toBe('2026-11-01');
  });
  it('nap at 14:00 on 2 Nov belongs to 2 Nov', () => {
    expect(sleepDayKey('nap', epochFor('2026-11-02', '14:00', MY), MY, 12)).toBe('2026-11-02');
  });
  it('a nap at 01:30 stays on its own date (never moved back)', () => {
    expect(sleepDayKey('nap', epochFor('2026-11-02', '01:30', MY), MY, 12)).toBe('2026-11-02');
  });
  it('cut-off boundary: 11:59 → previous day, 12:00 → same day', () => {
    expect(sleepDayKey('night', epochFor('2026-11-02', '11:59', MY), MY, 12)).toBe('2026-11-01');
    expect(sleepDayKey('night', epochFor('2026-11-02', '12:00', MY), MY, 12)).toBe('2026-11-02');
  });
  it('respects a custom cut-off hour', () => {
    expect(sleepDayKey('night', epochFor('2026-11-02', '05:00', MY), MY, 4)).toBe('2026-11-02');
  });
  it('uses the offset the sleep was logged in', () => {
    const t = Date.UTC(2026, 10, 1, 17, 30);
    expect(sleepDayKey('night', t, ID, 12)).toBe('2026-11-01'); // 00:30 in UTC+7 → still previous day
  });
});
