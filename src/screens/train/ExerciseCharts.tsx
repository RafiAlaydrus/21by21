import { LineChart } from '../../charts/LineChart';
import { Card } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { epley, isWork } from '../../logic/prs';
import { fmt1, fmtDay } from '../../logic/format';
import type { Workout } from '../../db/types';
import { C } from '../../theme';

/** best set (kg) and estimated 1RM per session for one exercise — from the user's own done sets */
export function useExerciseSeries(workouts: Workout[], exerciseId: string) {
  return workouts
    .filter((w) => w.sets.some((s) => s.exerciseId === exerciseId && isWork(s)))
    .sort((a, b) => a.checkIn - b.checkIn)
    .map((w, i) => {
      const sets = w.sets.filter((s) => s.exerciseId === exerciseId && isWork(s));
      const top = sets.reduce((m, s) => (s.weightKg > m.weightKg || (s.weightKg === m.weightKg && s.reps > m.reps) ? s : m));
      return { i, w, top, e1rm: Math.max(...sets.map((s) => epley(s.weightKg, s.reps))) };
    });
}

export function ExerciseCharts({ workouts, exerciseId }: { workouts: Workout[]; exerciseId: string }) {
  const nav = useNavigate();
  const pts = useExerciseSeries(workouts, exerciseId);
  if (pts.length === 0) return null;
  const chart = (title: string, color: string, val: (p: (typeof pts)[number]) => number, unit: string, tip: (p: (typeof pts)[number]) => string) => {
    const ys = pts.map(val);
    const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max(1, (hi - lo) * 0.2);
    return (
      <Card key={title}>
        <div className="row between baseline"><h2 className="t-card">{title}</h2><span className="num t-13 muted">{fmt1(ys.at(-1)!)} {unit} latest</span></div>
        <LineChart h={120} yLabels xDomain={[0, Math.max(1, pts.length - 1)]} yDomain={[lo - pad, hi + pad]} yTicks={[Math.round(lo), Math.round(hi)]} aria={`${title} per session`} onOpenDay={(k) => nav(`/day/${k}`)}
          xLabels={[{ x: 0, text: fmtDay(pts[0].w.dayKey, 'd MMM'), anchor: 'start' }, ...(pts.length > 1 ? [{ x: pts.length - 1, text: fmtDay(pts.at(-1)!.w.dayKey, 'd MMM'), anchor: 'end' as const }] : [])]}
          series={[{ color, dots: true, points: pts.map((p) => ({ x: p.i, y: val(p), dayKey: p.w.dayKey, tip: `${tip(p)} · ${fmtDay(p.w.dayKey, 'd MMM')}` })) }]} />
      </Card>
    );
  };
  return (
    <>
      {chart('Best set', C.yellow, (p) => p.top.weightKg, 'kg', (p) => `${fmt1(p.top.weightKg)} × ${p.top.reps}`)}
      {chart('Estimated 1RM', C.green, (p) => p.e1rm, 'kg', (p) => `${fmt1(p.e1rm)} kg`)}
    </>
  );
}
