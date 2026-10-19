import { useNavigate } from 'react-router-dom';
import { fmtTime } from '../../logic/dates';
import { fmtDayWd, fmtDuration, fmtInt } from '../../logic/format';
import { workoutMinutes, workoutVolume } from '../../logic/aggregate';
import { isWork } from '../../logic/prs';
import { prCountForWorkout } from '../../logic/prs';
import type { PREvent } from '../../logic/prs';
import { C } from '../../theme';
import type { Exercise, Gym, Workout } from '../../db/types';

/** "80 × 8, 80 × 7, 75 × 8" from the most recent earlier session that included the exercise */
export function lastTime(workouts: Workout[], exerciseId: string, before: number, excludeId?: string): { text: string; day: string } | null {
  const prev = workouts
    .filter((w) => w.id !== excludeId && w.checkIn < before && w.sets.some((s) => s.exerciseId === exerciseId && isWork(s)))
    .sort((a, b) => b.checkIn - a.checkIn)[0];
  if (!prev) return null;
  const sets = prev.sets.filter((s) => s.exerciseId === exerciseId && isWork(s)).sort((a, b) => a.order - b.order);
  return { text: sets.map((s) => `${s.weightKg} × ${s.reps}`).join(', '), day: prev.dayKey };
}

export const exName = (exercises: Exercise[], id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise';

export function SessionRow({ w, prs, gyms, onClick }: { w: Workout; prs: PREvent[]; gyms: Gym[]; onClick?: () => void }) {
  const nav = useNavigate();
  const n = prCountForWorkout(prs, w.id);
  const gym = gyms.find((g) => g.id === w.gymId)?.name;
  return (
    <button type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={onClick ?? (() => nav(`/train/session/${w.id}`))}>
      <span className="stack g2 grow">
        <span className="b600">{w.title || 'Workout'}{!w.checkOut && <span className="tag l" style={{ marginLeft: 8, color: C.red, background: 'rgba(255,55,95,0.2)' }}>ACTIVE</span>}</span>
        <span className="num t-12 muted">{fmtDayWd(w.dayKey)} · {fmtTime(w.checkIn, w.tzOffsetMin)}{w.checkOut ? ` · ${fmtDuration(workoutMinutes(w))}` : ''}{gym ? ` · ${gym}` : ''}</span>
      </span>
      <span className="stack g2 ta-right">
        <span className="num b600">{fmtInt(workoutVolume(w))} kg</span>
        {n > 0 && <span className="pr-badge">{n} PR{n > 1 ? 's' : ''}</span>}
      </span>
    </button>
  );
}
