import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card, IconBtn, Page, TextField } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useData } from '../../hooks/useData';
import { norm } from '../../logic/search';
import { ExerciseForm } from './ExercisePicker';
import { C } from '../../theme';

export default function Exercises() {
  const nav = useNavigate();
  const { exercises, workouts } = useData();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const sets = (id: string) => workouts.reduce((a, w) => a + w.sets.filter((s) => s.exerciseId === id && s.doneAt && !s.isWarmup).length, 0);
  const list = exercises.filter((e) => !q.trim() || norm(e.name).includes(norm(q.trim()))).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Page title="Exercises" sub={`${exercises.length} in your library`} glows={[{ color: C.red, top: -40, right: -100, opacity: 0.18 }]} right={<IconBtn icon="plus" label="New exercise" onClick={() => setCreating(true)} />}>
      <TextField label="Search" value={q} onChange={setQ} />
      {exercises.length === 0 && <div className="empty"><div className="b600">No exercises yet</div><div className="t-13 muted">Create the exercises you do; nothing is pre-filled.</div></div>}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {list.map((e) => (
          <button key={e.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => nav(`/train/exercise/${e.id}`)}>
            <span className="stack g2"><span className="b600">{e.name}</span><span className="t-12 muted">{e.muscleGroups.join(', ') || e.kind}</span></span>
            <span className="num t-13 muted">{sets(e.id)} sets ›</span>
          </button>
        ))}
      </Card>
      <Sheet open={creating} onClose={() => setCreating(false)} title="New exercise" tall><ExerciseForm onSaved={() => setCreating(false)} /></Sheet>
      <Btn onClick={() => setCreating(true)}>+ New exercise</Btn>
    </Page>
  );
}
