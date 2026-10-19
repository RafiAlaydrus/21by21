import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, TextField } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, tzNow } from '../../db/ops';
import { saveWorkout } from '../../db/actions';
import { defaultLogTime, logDay } from '../../hooks/useLogTime';
import type { LoggerProps } from '../../hooks/useLogger';
import type { Gym, Workout } from '../../db/types';
import { C } from '../../theme';

/** Workout tile: check-in = now, pick a gym (or create one), type a title. */
export default function StartSession({ open, onClose, dayKey }: LoggerProps) {
  const nav = useNavigate();
  const { gyms, workouts } = useData();
  const last = [...workouts].sort((a, b) => b.checkIn - a.checkIn)[0];
  const [gymId, setGymId] = useState<string | undefined>(last?.gymId);
  const [title, setTitle] = useState('');
  const [newGym, setNewGym] = useState(false);
  const [gymName, setGymName] = useState('');

  const start = async () => {
    let gid = gymId;
    if (newGym && gymName.trim()) {
      const g = newRec({ name: gymName.trim(), equipment: [] }) as Gym;
      await db.gyms.put(g); gid = g.id;
    }
    const day = logDay(dayKey);
    const past = !!dayKey && dayKey !== logDay();
    const checkIn = defaultLogTime(dayKey);
    const w = newRec({
      dayKey: day, checkIn, checkOut: past ? checkIn + 3600000 : undefined, tzOffsetMin: tzNow(), gymId: gid, title: title.trim(), sets: [], cardio: [], exerciseIds: [],
    }) as Workout;
    await saveWorkout(w);
    onClose();
    nav(past ? `/train/session/${w.id}` : '/train/session');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Start session">
      <TextField label="Title" value={title} onChange={setTitle} placeholder="e.g. Push" />
      <Cap>Gym</Cap>
      <div className="row wrap g8">
        <Chip on={!gymId && !newGym} onClick={() => { setGymId(undefined); setNewGym(false); }}>None</Chip>
        {gyms.map((g) => <Chip key={g.id} on={gymId === g.id && !newGym} onClick={() => { setGymId(g.id); setNewGym(false); }}>{g.name}</Chip>)}
        <Chip on={newGym} onClick={() => setNewGym(!newGym)}>+ New gym</Chip>
      </div>
      {newGym && <TextField label="Gym name" value={gymName} onChange={setGymName} autoFocus />}
      <Btn block tint={C.red} tintA={0.4} disabled={newGym && !gymName.trim()} onClick={() => void start()}>Start</Btn>
    </Sheet>
  );
}
