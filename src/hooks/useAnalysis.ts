import { useMemo } from 'react';
import { useData } from './useData';
import { aggregateDays } from '../logic/aggregate';
import type { DayAgg } from '../logic/aggregate';
import { headline, scoreDay, streak } from '../logic/score';
import type { DayScore, Headline } from '../logic/score';
import { computePRs } from '../logic/prs';
import type { PREvent } from '../logic/prs';
import { challengeDay, challengePhase, dayRange } from '../logic/dates';
import type { Phase } from '../logic/dates';

export interface Analysis {
  today: string; keys: string[]; cdays: string[]; aggs: Record<string, DayAgg>; scores: Record<string, DayScore>;
  head: Headline; prs: PREvent[]; phase: Phase; dayNo: number | null; streak: number;
}

/** All derived numbers for the challenge in one memoised pass (24 days of data is tiny). */
export function useAnalysis(): Analysis {
  const d = useData();
  return useMemo(() => {
    const c = d.settings.challenge;
    const keys = [...new Set([...dayRange(c.baselineDate, c.recapDate > c.endDate ? c.recapDate : c.endDate), d.today])].sort();
    const aggs = aggregateDays(d, keys);
    const scores: Record<string, DayScore> = {};
    for (const k of keys) scores[k] = scoreDay(aggs[k], d.settings, d.today);
    const cdays = dayRange(c.startDate, c.endDate);
    return {
      today: d.today, keys, cdays, aggs, scores,
      head: headline(scores, d.today, c), prs: computePRs(d.workouts),
      phase: challengePhase(d.today, c), dayNo: challengeDay(d.today, c),
      streak: streak(scores, aggs, d.today, c, d.settings.score.streakThreshold),
    };
  }, [d]);
}

/** one day's aggregate + score + timeline events (works for any day, inside the challenge or not) */
export function useDay(day: string) {
  const d = useData();
  const an = useAnalysis();
  return useMemo(() => {
    const agg = an.aggs[day] ?? aggregateDays(d, [day])[day];
    const score = an.scores[day] ?? scoreDay(agg, d.settings, d.today);
    return { agg, score, an };
  }, [d, an, day]);
}
