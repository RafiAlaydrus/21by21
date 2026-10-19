import { CardioSheet } from './CardioSheet';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { newRec, tzNow } from '../../db/ops';
import { saveWorkout } from '../../db/actions';
import { logDay } from '../../hooks/useLogTime';
import type { LoggerProps } from '../../hooks/useLogger';
import type { CardioEntry, Workout } from '../../db/types';

/** Cardio tile: adds to the active session, or logs a cardio-only session. */
export default function CardioLogger({ open, onClose, dayKey }: LoggerProps) {
  const { workouts } = useData();
  const toast = useToast();
  const save = async (c: CardioEntry) => {
    const active = [...workouts].filter((w) => !w.checkOut).sort((a, b) => b.checkIn - a.checkIn)[0];
    if (active && !dayKey) { await saveWorkout({ ...active, cardio: [...active.cardio, c] }); toast('Cardio added to the session'); return; }
    const end = Date.now();
    const w = newRec({ dayKey: logDay(dayKey), checkIn: end - c.durationMin * 60000, checkOut: end, tzOffsetMin: tzNow(), title: 'Cardio', sets: [], cardio: [c], exerciseIds: [] }) as Workout;
    await saveWorkout(w);
    toast('Cardio logged');
  };
  return <CardioSheet open={open} onClose={onClose} onSave={(c) => void save(c)} />;
}
