import { useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, Segmented, TextField } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec } from '../../db/ops';
import { norm } from '../../logic/search';
import { MUSCLE_GROUPS } from '../../db/types';
import type { Exercise } from '../../db/types';
import { C } from '../../theme';

/** Create / edit an exercise: name, muscle groups (fixed list), kind. */
export function ExerciseForm({ initial, kind: kindFixed, onSaved, onDelete }: { initial?: Exercise; kind?: 'strength' | 'cardio'; onSaved: (e: Exercise) => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [groups, setGroups] = useState<string[]>(initial?.muscleGroups ?? (kindFixed === 'cardio' ? ['Cardio'] : []));
  const [kind, setKind] = useState<'strength' | 'cardio'>(initial?.kind ?? kindFixed ?? 'strength');
  const toggle = (g: string) => setGroups(groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g]);
  const save = async () => {
    const fields = { name: name.trim(), muscleGroups: groups, kind };
    if (initial) onSaved(await saveRec(db.exercises, { ...initial, ...fields }));
    else { const e = newRec(fields) as Exercise; await db.exercises.put(e); onSaved(e); }
  };
  return (
    <div className="stack g12">
      <TextField label="Name" value={name} onChange={setName} autoFocus={!initial} />
      {!kindFixed && <Segmented value={kind} onChange={setKind} options={[{ value: 'strength', label: 'Strength' }, { value: 'cardio', label: 'Cardio' }]} />}
      <Cap>Muscle groups</Cap>
      <div className="row wrap g8">{MUSCLE_GROUPS.map((g) => <Chip key={g} sm on={groups.includes(g)} onClick={() => toggle(g)}>{g}</Chip>)}</div>
      <Btn block tint={C.red} tintA={0.4} disabled={!name.trim()} onClick={() => void save()}>{initial ? 'Save' : 'Create exercise'}</Btn>
      {onDelete && <Btn className="danger" onClick={onDelete}>Delete exercise</Btn>}
    </div>
  );
}

/** Searchable library + "Create exercise". */
export function ExercisePicker({ open, onClose, onPick, kind }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void; kind?: 'strength' | 'cardio' }) {
  const { exercises, workouts } = useData();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const uses = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts) for (const s of w.sets) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + 1);
    return m;
  }, [workouts]);
  const list = exercises.filter((e) => (!kind || e.kind === kind) && (!q.trim() || norm(e.name).includes(norm(q.trim())) || e.muscleGroups.some((g) => norm(g).includes(norm(q.trim()))))).sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const pick = (e: Exercise) => { onPick(e); setQ(''); setCreating(false); onClose(); };
  return (
    <Sheet open={open} onClose={() => { setCreating(false); onClose(); }} title={creating ? 'New exercise' : 'Exercise'} tall closeLabel={creating ? 'Back' : 'Close'}>
      {creating ? <ExerciseForm kind={kind} onSaved={pick} /> : (
        <>
          <TextField label="Search" value={q} onChange={setQ} placeholder="Exercise or muscle group" />
          <Btn onClick={() => setCreating(true)}>+ Create exercise</Btn>
          {list.length === 0 && <div className="t-13 muted">{exercises.length ? 'No match' : 'Your exercise library is empty. Create the first one.'}</div>}
          <div className="stack g8">
            {list.map((e) => (
              <button key={e.id} type="button" className="glass-btn row between" style={{ borderRadius: 16, padding: '10px 14px', minHeight: 54, textAlign: 'left' }} onClick={() => pick(e)}>
                <span className="stack g2"><span className="b600">{e.name}</span><span className="t-12 muted">{e.muscleGroups.join(', ') || e.kind}</span></span>
                {(uses.get(e.id) ?? 0) > 0 && <span className="t-12 muted">{uses.get(e.id)} sets</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
