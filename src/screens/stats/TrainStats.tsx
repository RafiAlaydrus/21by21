import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Chip } from '../../components/ui';
import { BarChart } from '../../charts/BarChart';
import { LineChart } from '../../charts/LineChart';
import { Scatter } from '../../charts/Scatter';
import { HBars } from '../../charts/bits';
import { useData } from '../../hooks/useData';
import type { Analysis } from '../../hooks/useAnalysis';
import { minutesOfDay } from '../../logic/dates';
import { muscleSplit, sum, weekBuckets } from '../../logic/stats';
import { workoutHasWork, workoutMinutes, workoutVolume } from '../../logic/aggregate';
import { PR_LABEL } from '../../logic/prs';
import { fmtDay, fmtDayWd, fmtDuration, fmtInt, fmtMinOfDay } from '../../logic/format';
import { exName } from '../train/bits';
import { ExerciseCharts } from '../train/ExerciseCharts';
import { prValue } from '../train/PRWall';
import { StatCard } from './common';
import { C } from '../../theme';

export function TrainStats({ an }: { an: Analysis }) {
  const nav = useNavigate();
  const d = useData();
  const c = d.settings.challenge;
  const done = useMemo(() => d.workouts.filter(workoutHasWork).sort((a, b) => a.checkIn - b.checkIn), [d.workouts]);
  const weeks = weekBuckets(an.aggs, c, an.today);
  const maxW = Math.max(1, ...weeks.map((w) => w.sessions));
  const split = muscleSplit(done, d.exercises).slice(0, 8);
  const maxSplit = Math.max(1, ...split.map((s) => s.pct));
  const used = d.exercises.filter((e) => e.kind === 'strength' && done.some((w) => w.sets.some((s) => s.exerciseId === e.id && s.doneAt)));
  const [exId, setEx] = useState<string | undefined>();
  const ex = exId ?? used[0]?.id;
  const total = sum(done.map(workoutVolume));
  const prs = [...an.prs].sort((a, b) => b.time - a.time).slice(0, 5);
  const idx = (k: string) => an.cdays.indexOf(k) + 1;

  return (
    <>
      <StatCard title="Training" right={`${fmtInt(total)} kg total`}>
        <div className="cap">Sessions per week</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, weeks.length)}, minmax(0, 1fr))`, gap: 10, alignItems: 'end', height: 120 }}>
          {weeks.map((w) => (
            <div key={w.index} className="stack col-center g6"><span className="num t-13 b600">{w.sessions}</span><span style={{ width: '100%', height: Math.max(4, (w.sessions / maxW) * 70), borderRadius: 8, background: C.red }} /><span className="t-11 muted">Wk {w.index}{w.days < 7 ? ` (${w.days} d)` : ''}</span></div>
          ))}
        </div>
        <div className="cap">Volume by muscle group</div>
        {split.length === 0 ? <div className="muted t-13">No sets logged</div> : <HBars rows={split.map((s) => ({ label: s.group, pct: (s.pct / maxSplit) * 100, text: `${Math.round(s.pct)}%`, color: C.red }))} labelW={80} valueW={38} />}
      </StatCard>

      <StatCard title="Session volume" right="kg">
        {done.length === 0 ? <div className="muted t-13">No sessions yet</div> : (
          <LineChart yLabels xDomain={[0, Math.max(1, done.length - 1)]} yDomain={[0, Math.max(...done.map(workoutVolume)) * 1.1]} yTicks={[0, Math.round(Math.max(...done.map(workoutVolume)) / 2000) * 1000, Math.round(Math.max(...done.map(workoutVolume)) / 1000) * 1000]} aria="Volume per session" onOpenDay={(k) => nav(`/day/${k}`)} fmtTick={(n) => (n >= 1000 ? `${n / 1000}k` : String(n))}
            series={[{ color: C.red, dots: true, points: done.map((w, i) => ({ x: i, y: workoutVolume(w), dayKey: w.dayKey, tip: `${w.title || 'Session'} · ${fmtInt(workoutVolume(w))} kg · ${fmtDay(w.dayKey, 'd MMM')}` })) }]} />
        )}
      </StatCard>

      <StatCard title="Duration per session">
        {done.filter((w) => w.checkOut).length === 0 ? <div className="muted t-13">No finished sessions</div> : (
          <BarChart aria="Duration per session in minutes" onOpenDay={(k) => nav(`/day/${k}`)}
            groups={done.filter((w) => w.checkOut).map((w, i) => ({ key: w.id, dayKey: w.dayKey, label: i % 3 === 0 ? fmtDay(w.dayKey, 'd/M') : '', tip: `${w.title || 'Session'} · ${fmtDuration(workoutMinutes(w))}`, items: [{ v: workoutMinutes(w), color: C.red }] }))} />
        )}
      </StatCard>

      <StatCard title="Per exercise" right={ex ? exName(d.exercises, ex) : undefined}>
        {used.length === 0 ? <div className="muted t-13">No exercises with done sets</div> : <div className="chips-scroll">{used.map((e) => <Chip key={e.id} sm on={ex === e.id} onClick={() => setEx(e.id)}>{e.name}</Chip>)}</div>}
        {ex && <ExerciseCharts workouts={d.workouts} exerciseId={ex} />}
        {ex && <Btn sm onClick={() => nav(`/train/exercise/${ex}`)}>Open exercise ›</Btn>}
      </StatCard>

      <StatCard title="PR wall" right={`${new Set(an.prs.map((p) => `${p.workoutId}:${p.exerciseId}`)).size} records`}>
        {prs.length === 0 && <div className="muted t-13">No records yet</div>}
        {prs.map((p, i) => (
          <button key={i} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => nav(`/train/exercise/${p.exerciseId}`)}>
            <span className="stack g2"><span className="b600">{exName(d.exercises, p.exerciseId)}</span><span className="t-12 muted">{PR_LABEL[p.type]} · {fmtDayWd(p.dayKey)}</span></span>
            <span className="num b700" style={{ color: C.yellow }}>{prValue(p)}</span>
          </button>
        ))}
        <Btn sm onClick={() => nav('/train/prs')}>All records ›</Btn>
      </StatCard>

      <StatCard title="Gym check-in times">
        {done.length < 2 ? <div className="muted t-13">Needs at least 2 sessions</div> : (
          <Scatter xLabel="Challenge day" yLabel="Hour" aria="Gym check-in time of day per session" color={C.red} onOpenDay={(k) => nav(`/day/${k}`)}
            points={done.map((w) => ({ x: idx(w.dayKey), y: Math.round((minutesOfDay(w.checkIn, w.tzOffsetMin) / 60) * 10) / 10, key: w.dayKey, tip: `${fmtMinOfDay(minutesOfDay(w.checkIn, w.tzOffsetMin))} · ${fmtDay(w.dayKey, 'd MMM')}` }))} />
        )}
        <div className="cap">Gyms</div>
        {d.gyms.length === 0 && <div className="muted t-13">No gyms saved</div>}
        {d.gyms.map((g) => <div key={g.id} className="row between t-15"><span>{g.name}</span><span className="num muted">{done.filter((w) => w.gymId === g.id).length} sessions</span></div>)}
        <div className="row g8"><Btn sm onClick={() => nav('/train/gyms')}>Gyms ›</Btn><Btn sm onClick={() => nav('/train/gym-map')} disabled={!d.gyms.some((g) => g.lat != null)}>Map ›</Btn></div>
      </StatCard>
    </>
  );
}
