import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Card, Cap, Page } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { bestsFor, computePRs, isWork, prSetIds, PR_LABEL, setVolume } from '../../logic/prs';
import { fmtDayLong, fmt1, fmtInt } from '../../logic/format';
import { ExerciseForm } from './ExercisePicker';
import { ExerciseCharts } from './ExerciseCharts';
import { prValue } from './PRWall';
import { C } from '../../theme';

export default function ExerciseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { exercises, workouts } = useData();
  const [edit, setEdit] = useState(false);
  const ex = exercises.find((e) => e.id === id);
  const prs = useMemo(() => computePRs(workouts), [workouts]);
  const sessions = useMemo(() => workouts.filter((w) => w.sets.some((s) => s.exerciseId === id && s.doneAt)).sort((a, b) => b.checkIn - a.checkIn), [workouts, id]);
  if (!ex) return <Page title="Exercise"><div className="empty"><div className="b600">Exercise not found</div></div></Page>;
  const b = bestsFor(workouts, ex.id);
  const ids = prSetIds(prs);
  const mine = prs.filter((p) => p.exerciseId === ex.id).sort((a, c) => c.time - a.time);

  return (
    <Page title={ex.name} sub={ex.muscleGroups.join(', ') || ex.kind} glows={[{ color: C.red, top: -40, right: -100, opacity: 0.18 }]} right={<Btn sm onClick={() => setEdit(true)}>Edit</Btn>}>
      <div className="grid2">
        {([
          ['Heaviest', b.heaviest ? `${fmt1(b.heaviest.weightKg)} × ${b.heaviest.reps}` : '—'],
          ['Best est. 1RM', b.bestE1rm ? `${fmt1(b.bestE1rm.v)} kg` : '—'],
          ['Best set volume', b.bestSetVolume ? `${fmtInt(setVolume(b.bestSetVolume))} kg` : '—'],
          ['Best session volume', b.bestSessionVolume ? `${fmtInt(b.bestSessionVolume)} kg` : '—'],
        ] as const).map(([l, v]) => (
          <Card key={l} tile><Cap>{l}</Cap><div className="big-num num">{v}</div></Card>
        ))}
      </div>

      <ExerciseCharts workouts={workouts} exerciseId={ex.id} />

      <Card>
        <h2 className="t-card">Personal records</h2>
        {mine.length === 0 && <div className="muted t-13">No records yet. A record needs an earlier session to beat.</div>}
        {mine.map((p, i) => (
          <div key={i} className="row between">
            <span className="stack g2"><span className="t-15 b600">{PR_LABEL[p.type]}</span><span className="t-12 muted">{fmtDayLong(p.dayKey)}</span></span>
            <span className="num b700" style={{ color: C.yellow }}>{prValue(p)}</span>
          </div>
        ))}
      </Card>

      <Card className="flat" style={{ padding: '12px 16px' }}>
        <h2 className="t-card" style={{ marginBottom: 6 }}>All sets</h2>
        {sessions.length === 0 && <div className="muted t-13" style={{ padding: '8px 0' }}>No sets logged for this exercise</div>}
        {sessions.map((w) => (
          <button key={w.id} type="button" className="rowline" style={{ alignItems: 'flex-start' }} onClick={() => nav(`/train/session/${w.id}`)}>
            <span className="stack g4 grow">
              <span className="b600">{fmtDayLong(w.dayKey)} <span className="muted t-12">{w.title}</span></span>
              <span className="row wrap g8 num t-13">
                {w.sets.filter((s) => s.exerciseId === ex.id && s.doneAt).sort((a, c) => a.order - c.order).map((s) => (
                  <span key={s.id} className={s.isWarmup ? 'muted' : ''}>{s.isWarmup ? 'W ' : ''}{fmt1(s.weightKg)} × {s.reps}{ids.has(s.id) && isWork(s) ? <span className="pr-badge" style={{ marginLeft: 4 }}>PR</span> : null}</span>
                ))}
              </span>
            </span>
          </button>
        ))}
      </Card>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit exercise" tall>
        <ExerciseForm initial={ex} onSaved={() => setEdit(false)} onDelete={async () => { await db.exercises.delete(ex.id); setEdit(false); nav(-1); toast('Exercise deleted', { undo: () => void db.exercises.put(ex) }); }} />
      </Sheet>
    </Page>
  );
}
