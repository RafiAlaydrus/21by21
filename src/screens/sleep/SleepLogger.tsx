import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, DateTimeField, Segmented } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { delMeta, newRec, saveRec, setMeta, tzNow } from '../../db/ops';
import { addDays, dayKey, durationMin, epochFor, sleepDayKey } from '../../logic/dates';
import { fmtDuration } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { Sleep } from '../../db/types';
import { C } from '../../theme';

/** Sleep tile: Nap or Night? → starts the sleep. Also add / edit / delete a past sleep. */
export default function SleepLogger({ open, onClose, id }: LoggerProps) {
  const { sleeps, settings } = useData();
  const toast = useToast();
  const existing = id ? sleeps.find((s) => s.id === id) : undefined;
  const [form, setForm] = useState(!!existing);

  const start = async (kind: 'nap' | 'night') => {
    await setMeta('activeSleep', { kind, start: Date.now(), tzOffsetMin: tzNow() });
    onClose();
    toast(kind === 'night' ? 'Night sleep started' : 'Nap started', { ms: 10000, undo: () => void delMeta('activeSleep') });
  };

  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Edit sleep' : 'Sleep'} tall={form}>
      {!form ? (
        <>
          <div className="t-17 b600 ta-center" style={{ padding: '4px 0' }}>Nap or Night?</div>
          <div className="grid2">
            {(['nap', 'night'] as const).map((k) => (
              <button key={k} type="button" className="glass-btn" onClick={() => void start(k)}
                style={{ borderRadius: 24, minHeight: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(191,90,242,0.18)', fontSize: 20, fontWeight: 700 }}>
                <Icon name={k === 'night' ? 'moon' : 'sun'} size={34} color={C.purpleLight} />
                {k === 'night' ? 'Night' : 'Nap'}
              </button>
            ))}
          </div>
          <Btn onClick={() => setForm(true)}>Add a past sleep</Btn>
        </>
      ) : (
        <SleepForm key={id ?? 'new'} existing={existing} cutoff={settings.sleepNightCutoffHour} onDone={onClose} />
      )}
    </Sheet>
  );
}

function SleepForm({ existing, cutoff, onDone }: { existing?: Sleep; cutoff: number; onDone: () => void }) {
  const toast = useToast();
  const tz = existing?.tzOffsetMin ?? tzNow();
  const defStart = epochFor(addDays(dayKey(Date.now(), tz), -1), '23:00', tz);
  const [kind, setKind] = useState<'night' | 'nap'>(existing?.kind ?? 'night');
  const [start, setStart] = useState(existing?.start ?? defStart);
  const [end, setEnd] = useState(existing?.end ?? epochFor(dayKey(Date.now(), tz), '07:00', tz));
  const valid = end > start;

  const save = async () => {
    const dk = sleepDayKey(kind, start, tz, cutoff);
    const dur = durationMin(start, end);
    if (existing) await saveRec(db.sleeps, { ...existing, kind, start, end, tzOffsetMin: tz, endTzOffsetMin: tz, dayKey: dk, durationMin: dur });
    else await db.sleeps.put(newRec({ kind, start, end, tzOffsetMin: tz, endTzOffsetMin: tz, dayKey: dk, durationMin: dur }, true) as Sleep);
    toast(`Saved · ${fmtDuration(dur)}`);
    onDone();
  };
  const del = async () => {
    if (!existing) return;
    await db.sleeps.delete(existing.id);
    onDone();
    toast('Sleep deleted', { undo: () => void db.sleeps.put(existing) });
  };
  return (
    <>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'night', label: 'Night' }, { value: 'nap', label: 'Nap' }]} />
      <DateTimeField label="Fell asleep" value={start} tz={tz} onChange={setStart} />
      <DateTimeField label="Woke up" value={end} tz={tz} onChange={setEnd} />
      <div className="t-13 muted ta-center">{valid ? `${fmtDuration(durationMin(start, end))} · counts for ${sleepDayKey(kind, start, tz, cutoff)}` : 'Wake time must be after the sleep start'}</div>
      <Btn block tint={C.purple} disabled={!valid} onClick={() => void save()}>Save</Btn>
      {existing && <Btn className="danger" onClick={() => void del()}>Delete sleep</Btn>}
    </>
  );
}
