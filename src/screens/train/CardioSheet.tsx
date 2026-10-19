import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, NumField } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { uid } from '../../db/ops';
import { ExerciseForm } from './ExercisePicker';
import type { CardioEntry } from '../../db/types';
import { C } from '../../theme';

/** Add / edit one cardio entry: exercise + duration (required) + optional speed, incline, distance, kcal. */
export function CardioSheet({ open, onClose, initial, onSave, onRemove }: { open: boolean; onClose: () => void; initial?: CardioEntry; onSave: (c: CardioEntry) => void; onRemove?: () => void }) {
  const { exercises } = useData();
  const cardioEx = exercises.filter((e) => e.kind === 'cardio');
  const [exId, setExId] = useState(initial?.exerciseId ?? cardioEx[0]?.id);
  const [creating, setCreating] = useState(false);
  const [dur, setDur] = useState<number | undefined>(initial?.durationMin);
  const [speed, setSpeed] = useState(initial?.speedKmh);
  const [incline, setIncline] = useState(initial?.inclinePct);
  const [dist, setDist] = useState(initial?.distanceKm);
  const [kcal, setKcal] = useState(initial?.kcal);
  const ok = !!exId && !!dur;
  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'Edit cardio' : 'Cardio'} tall action={{ label: 'Save', disabled: !ok, onClick: () => { onSave({ id: initial?.id ?? uid(), exerciseId: exId!, durationMin: dur!, speedKmh: speed, inclinePct: incline, distanceKm: dist, kcal }); onClose(); } }}>
      <Cap>Exercise</Cap>
      <div className="row wrap g8">
        {cardioEx.map((e) => <Chip key={e.id} on={exId === e.id} onClick={() => setExId(e.id)}>{e.name}</Chip>)}
        <Chip className="light" onClick={() => setCreating(!creating)}>+ New</Chip>
      </div>
      {creating && <ExerciseForm kind="cardio" onSaved={(e) => { setExId(e.id); setCreating(false); }} />}
      <NumField label="Duration" unit="min" big value={dur} onChange={setDur} />
      <div className="grid2">
        <NumField label="Speed" unit="km/h" value={speed} onChange={setSpeed} />
        <NumField label="Incline" unit="%" value={incline} onChange={setIncline} />
        <NumField label="Distance" unit="km" value={dist} onChange={setDist} />
        <NumField label="Calories" unit="kcal" value={kcal} onChange={setKcal} />
      </div>
      <Btn block tint={C.red} tintA={0.4} disabled={!ok} onClick={() => { onSave({ id: initial?.id ?? uid(), exerciseId: exId!, durationMin: dur!, speedKmh: speed, inclinePct: incline, distanceKm: dist, kcal }); onClose(); }}>Save</Btn>
      {initial && <Btn className="danger" onClick={() => { onRemove?.(); onClose(); }}>Remove</Btn>}
    </Sheet>
  );
}
