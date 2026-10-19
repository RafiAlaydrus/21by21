import type { Workout, WorkoutSet } from '../db/types';

export type PRType = 'weight' | 'reps' | 'e1rm' | 'setVolume' | 'sessionVolume';
export interface PREvent {
  exerciseId: string; type: PRType; value: number; prev: number; weightKg?: number; reps?: number;
  setId?: string; workoutId: string; dayKey: string; time: number;
}

export const epley = (w: number, reps: number) => w * (1 + reps / 30);
export const setVolume = (s: Pick<WorkoutSet, 'weightKg' | 'reps'>) => s.weightKg * s.reps;
/** a set counts only once it is marked done; warm-ups never count */
export const isWork = (s: WorkoutSet) => !!s.doneAt && !s.isWarmup && s.reps > 0;

interface ExState { weight: number; e1rm: number; setVol: number; sessVol: number; repsAt: Map<number, number>; sessions: number }

/**
 * Personal records from the user's own done sets only (warm-ups excluded).
 * The first time an exercise is ever done is the baseline, not a PR: a PR needs an earlier session to beat.
 */
export function computePRs(workouts: Workout[]): PREvent[] {
  const events: PREvent[] = [];
  const state = new Map<string, ExState>();
  const sorted = [...workouts].sort((a, b) => a.checkIn - b.checkIn);
  for (const w of sorted) {
    const byEx = new Map<string, WorkoutSet[]>();
    for (const s of [...w.sets].sort((a, b) => a.order - b.order)) if (isWork(s)) {
      if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
      byEx.get(s.exerciseId)!.push(s);
    }
    for (const [exId, sets] of byEx) {
      const st = state.get(exId) ?? { weight: 0, e1rm: 0, setVol: 0, sessVol: 0, repsAt: new Map(), sessions: 0 };
      const hist = st.sessions > 0;
      const emit = (type: PRType, value: number, prev: number, s?: WorkoutSet) =>
        events.push({ exerciseId: exId, type, value, prev, weightKg: s?.weightKg, reps: s?.reps, setId: s?.id, workoutId: w.id, dayKey: w.dayKey, time: s?.doneAt ?? w.checkIn });
      let sessVol = 0;
      for (const s of sets) {
        const vol = setVolume(s), e = epley(s.weightKg, s.reps), prevReps = st.repsAt.get(s.weightKg);
        if (hist && s.weightKg > st.weight) emit('weight', s.weightKg, st.weight, s);
        if (hist && prevReps !== undefined && s.reps > prevReps) emit('reps', s.reps, prevReps, s);
        if (hist && e > st.e1rm + 1e-9) emit('e1rm', e, st.e1rm, s);
        if (hist && vol > st.setVol) emit('setVolume', vol, st.setVol, s);
        st.weight = Math.max(st.weight, s.weightKg);
        st.e1rm = Math.max(st.e1rm, e);
        st.setVol = Math.max(st.setVol, vol);
        st.repsAt.set(s.weightKg, Math.max(prevReps ?? 0, s.reps));
        sessVol += vol;
      }
      if (hist && sessVol > st.sessVol) emit('sessionVolume', sessVol, st.sessVol);
      st.sessVol = Math.max(st.sessVol, sessVol);
      st.sessions += 1;
      state.set(exId, st);
    }
  }
  return events;
}

/** PRs in a session = number of exercises that set at least one record in it */
export function prCountForWorkout(events: PREvent[], workoutId: string): number {
  return new Set(events.filter((e) => e.workoutId === workoutId).map((e) => e.exerciseId)).size;
}
export const prSetIds = (events: PREvent[]): Set<string> => new Set(events.filter((e) => e.setId).map((e) => e.setId!));
export const prExercisesForWorkout = (events: PREvent[], workoutId: string): string[] => [...new Set(events.filter((e) => e.workoutId === workoutId).map((e) => e.exerciseId))];

export const PR_LABEL: Record<PRType, string> = {
  weight: 'Heaviest weight', reps: 'Most reps at weight', e1rm: 'Best est. 1RM', setVolume: 'Best set volume', sessionVolume: 'Best session volume',
};

/** all-time bests per exercise (for the exercise detail page) */
export function bestsFor(workouts: Workout[], exerciseId: string) {
  let heaviest: WorkoutSet | undefined, bestE: { v: number; s: WorkoutSet } | undefined, bestVol: WorkoutSet | undefined, bestSession = 0;
  for (const w of workouts) {
    let sv = 0;
    for (const s of w.sets) if (s.exerciseId === exerciseId && isWork(s)) {
      if (!heaviest || s.weightKg > heaviest.weightKg || (s.weightKg === heaviest.weightKg && s.reps > heaviest.reps)) heaviest = s;
      const e = epley(s.weightKg, s.reps);
      if (!bestE || e > bestE.v) bestE = { v: e, s };
      if (!bestVol || setVolume(s) > setVolume(bestVol)) bestVol = s;
      sv += setVolume(s);
    }
    bestSession = Math.max(bestSession, sv);
  }
  return { heaviest, bestE1rm: bestE, bestSetVolume: bestVol, bestSessionVolume: bestSession };
}
