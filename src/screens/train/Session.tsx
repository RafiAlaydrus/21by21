import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Card, Cap, Chip, DateTimeField, Empty, Glows, IconBtn, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { SwipeRow } from '../../components/SwipeRow';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { db } from '../../db/schema';
import { saveWorkout } from '../../db/actions';
import { uid } from '../../db/ops';
import { computePRs, isWork, prCountForWorkout, prSetIds } from '../../logic/prs';
import { workoutMinutes, workoutVolume } from '../../logic/aggregate';
import { fmtClock, fmtDayLong, fmtDuration, fmtInt, fmtMacro } from '../../logic/format';
import { fmtTime } from '../../logic/dates';
import { ExercisePicker } from './ExercisePicker';
import { CardioSheet } from './CardioSheet';
import { exName, lastTime } from './bits';
import type { CardioEntry, Workout, WorkoutSet } from '../../db/types';
import { C } from '../../theme';

/** Local draft of the workout that autosaves (debounced) and flushes on leave. */
function useDraft(initial: Workout) {
  const [w, setW] = useState(initial);
  const latest = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef<number>();
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (dirty.current) { dirty.current = false; void saveWorkout(latest.current); }
  }, []);
  const update = useCallback((fn: (w: Workout) => Workout) => {
    const next = fn(latest.current);
    latest.current = next; dirty.current = true; setW(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 250);
  }, [flush]);
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);
  return [w, update, flush] as const;
}

function MiniNum({ value, onChange, unit, mode, label }: { value: number; onChange: (n: number) => void; unit: string; mode: 'decimal' | 'numeric'; label: string }) {
  const [txt, setTxt] = useState(value ? String(value) : '');
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { last.current = value; setTxt(value ? String(value) : ''); } }, [value]);
  return (
    <label className="glass-btn row" style={{ borderRadius: 14, padding: '8px 10px', gap: 4, flex: 1, minWidth: 0, minHeight: 46 }}>
      <input aria-label={label} inputMode={mode} value={txt} placeholder="0" className="num"
        style={{ fontSize: 20, fontWeight: 700, textAlign: 'right' }}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          if (t !== '' && !/^\d*\.?\d*$/.test(t)) return;
          setTxt(t);
          const n = t === '' || t === '.' ? 0 : parseFloat(t);
          last.current = n; onChange(n);
        }} />
      <span className="muted t-13" style={{ flexShrink: 0 }}>{unit}</span>
    </label>
  );
}

export default function Session() {
  const { id } = useParams();
  const { workouts } = useData();
  const found = id ? workouts.find((w) => w.id === id) : [...workouts].filter((w) => !w.checkOut).sort((a, b) => b.checkIn - a.checkIn)[0];
  if (!found) return (
    <div className="screen no-tabs"><Glows list={[{ color: C.red, top: -40, left: -100, opacity: 0.2 }]} />
      <Empty title="No active session" sub="Start one from the Train tab." /></div>
  );
  return <Editor key={found.id} initial={found} />;
}

function Editor({ initial }: { initial: Workout }) {
  const nav = useNavigate();
  const toast = useToast();
  const data = useData();
  const { workouts, exercises, gyms, settings } = data;
  const [w, update, flush] = useDraft(initial);
  const [picker, setPicker] = useState(false);
  const [cardio, setCardio] = useState<{ initial?: CardioEntry; n: number } | null>(null);
  const [finish, setFinish] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const active = !w.checkOut;
  const now = useNow(rest || active ? 1000 : 60000);

  const all = useMemo(() => workouts.map((x) => (x.id === w.id ? w : x)), [workouts, w]);
  const prs = useMemo(() => computePRs(all), [all]);
  const prIds = useMemo(() => prSetIds(prs), [prs]);
  const sessionPRs = prCountForWorkout(prs, w.id);

  // exercise groups in order of first appearance
  const groups = useMemo(() => {
    const order: string[] = [];
    for (const s of [...w.sets].sort((a, b) => a.order - b.order)) if (!order.includes(s.exerciseId)) order.push(s.exerciseId);
    return order.map((exId) => ({ exId, sets: w.sets.filter((s) => s.exerciseId === exId).sort((a, b) => a.order - b.order) }));
  }, [w.sets]);

  const nextOrder = () => w.sets.reduce((m, s) => Math.max(m, s.order), -1) + 1;
  const patchSet = (sid: string, p: Partial<WorkoutSet>) => update((x) => ({ ...x, sets: x.sets.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const addSet = (exId: string) => update((x) => {
    const prev = x.sets.filter((s) => s.exerciseId === exId).sort((a, b) => a.order - b.order).at(-1);
    return { ...x, sets: [...x.sets, { id: uid(), exerciseId: exId, order: x.sets.reduce((m, s) => Math.max(m, s.order), -1) + 1, weightKg: prev?.weightKg ?? 0, reps: prev?.reps ?? 0, isWarmup: false }] };
  });
  const toggleDone = (s: WorkoutSet) => {
    const done = !s.doneAt;
    patchSet(s.id, { doneAt: done ? Date.now() : undefined });
    if (done && settings.restTimer.enabled && active) setRest(Date.now());
  };
  const removeSet = (s: WorkoutSet) => {
    update((x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }));
    toast('Set deleted', { undo: () => update((x) => ({ ...x, sets: [...x.sets, s] })) });
  };
  const removeExercise = (exId: string) => {
    const removed = w.sets.filter((s) => s.exerciseId === exId);
    update((x) => ({ ...x, sets: x.sets.filter((s) => s.exerciseId !== exId) }));
    toast(`${exName(exercises, exId)} removed`, { undo: () => update((x) => ({ ...x, sets: [...x.sets, ...removed] })) });
  };
  const addExercise = (exId: string) => update((x) => ({ ...x, sets: [...x.sets, { id: uid(), exerciseId: exId, order: nextOrder(), weightKg: 0, reps: 0, isWarmup: false }] }));

  const upsertCardio = (c: CardioEntry) => update((x) => ({ ...x, cardio: x.cardio.some((y) => y.id === c.id) ? x.cardio.map((y) => (y.id === c.id ? c : y)) : [...x.cardio, c] }));

  const del = async () => {
    flush();
    await db.workouts.delete(w.id);
    nav('/train', { replace: true });
    toast('Session deleted', { undo: () => void db.workouts.put(w) });
  };

  const gym = gyms.find((g) => g.id === w.gymId);
  const doneSets = w.sets.filter(isWork).length;
  const restSec = rest ? Math.floor((now - rest) / 1000) : 0;
  const restLeft = settings.restTimer.seconds - restSec;

  return (
    <div className="screen no-tabs fade-in">
      <Glows list={[{ color: C.red, top: -40, left: -100, size: 320, opacity: 0.2 }, { color: C.red, top: 900, right: -120, opacity: 0.1 }]} />
      <header className="hdr">
        <IconBtn icon="back" label="Back" onClick={() => { flush(); if (active) nav('/train'); else nav(-1); }} />
        <div className="hdr-title"><h1>{w.title || 'Workout'}</h1><div className="sub num">{active ? fmtClock((now - w.checkIn) / 1000) : fmtDayLong(w.dayKey)}</div></div>
        <Btn sm tint={C.red} tintA={0.45} onClick={() => setFinish(true)}>{active ? 'Finish' : 'Details'}</Btn>
      </header>

      <Card>
        <TextField label="Title" value={w.title} onChange={(v) => update((x) => ({ ...x, title: v }))} placeholder="e.g. Push" />
        <div className="chips-scroll">
          <Chip sm on={!w.gymId} onClick={() => update((x) => ({ ...x, gymId: undefined }))}>No gym</Chip>
          {gyms.map((g) => <Chip key={g.id} sm on={w.gymId === g.id} onClick={() => update((x) => ({ ...x, gymId: g.id }))}>{g.name}</Chip>)}
        </div>
        <div className="row between t-13 muted num"><span>Checked in {fmtTime(w.checkIn, w.tzOffsetMin)}{w.checkOut ? ` · out ${fmtTime(w.checkOut, w.tzOffsetMin)}` : ''}</span><span>{gym?.name ?? ''}</span></div>
      </Card>

      {groups.length === 0 && w.cardio.length === 0 && <Empty title="No exercises yet" sub="Add an exercise to start logging sets." />}

      {groups.map(({ exId, sets }) => {
        const ex = exercises.find((e) => e.id === exId);
        const lt = lastTime(workouts, exId, w.checkIn, w.id);
        let n = 0;
        return (
          <Card key={exId} aria-label={ex?.name}>
            <div className="row between">
              <div className="stack g2 grow"><h2 className="t-card clip">{ex?.name ?? 'Exercise'}</h2><span className="t-12 muted">{ex?.muscleGroups.join(', ')}</span></div>
              <IconBtn small icon="trash" label={`Remove ${ex?.name ?? 'exercise'}`} onClick={() => removeExercise(exId)} />
            </div>
            <div className="num t-13 muted" style={{ minHeight: 18 }}>{lt ? `Last time: ${lt.text}` : 'No earlier sets'}</div>
            <div className="stack">
              {sets.map((s) => {
                if (!s.isWarmup) n += 1;
                const pr = prIds.has(s.id);
                return (
                  <SwipeRow key={s.id} onDelete={() => removeSet(s)}>
                    <div className="row g8" style={{ padding: '6px 0' }}>
                      <button type="button" aria-label={s.isWarmup ? 'Warm-up set, tap to make a working set' : 'Working set, tap to mark as warm-up'} aria-pressed={!!s.isWarmup}
                        className="glass-btn icon-btn sm b700" style={{ fontSize: 14, color: s.isWarmup ? C.yellow : C.text, width: 38, height: 38 }} onClick={() => patchSet(s.id, { isWarmup: !s.isWarmup })}>{s.isWarmup ? 'W' : n}</button>
                      <MiniNum label="Weight" unit="kg" mode="decimal" value={s.weightKg} onChange={(v) => patchSet(s.id, { weightKg: v })} />
                      <span className="muted">×</span>
                      <MiniNum label="Reps" unit="reps" mode="numeric" value={s.reps} onChange={(v) => patchSet(s.id, { reps: Math.round(v) })} />
                      <button type="button" aria-label={s.doneAt ? 'Mark set not done' : 'Mark set done'} aria-pressed={!!s.doneAt} className="glass-btn icon-btn sm"
                        style={{ width: 42, height: 42, background: s.doneAt ? 'rgba(48,209,88,0.55)' : undefined }} onClick={() => toggleDone(s)}><Icon name="check" size={20} sw={2.6} /></button>
                    </div>
                    {pr && s.doneAt && !s.isWarmup && <div style={{ padding: '0 0 6px 46px' }}><span className="pr-badge">PR</span></div>}
                  </SwipeRow>
                );
              })}
            </div>
            <Btn sm onClick={() => addSet(exId)}>+ Set</Btn>
          </Card>
        );
      })}

      {w.cardio.length > 0 && (
        <Card className="flat" style={{ padding: '12px 16px' }}>
          <Cap>Cardio</Cap>
          {w.cardio.map((c) => (
            <button key={c.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => setCardio({ initial: c, n: Date.now() })}>
              <span className="stack g2"><span className="b600">{exName(exercises, c.exerciseId)}</span>
                <span className="num t-12 muted">{[`${fmtMacro(c.durationMin)} min`, c.speedKmh != null && `${c.speedKmh} km/h`, c.inclinePct != null && `${c.inclinePct}% incline`, c.distanceKm != null && `${c.distanceKm} km`, c.kcal != null && `${c.kcal} kcal`].filter(Boolean).join(' · ')}</span></span>
              <Icon name="edit" size={18} color={C.text2} />
            </button>
          ))}
        </Card>
      )}

      <div className="grid2">
        <Btn tint={C.red} tintA={0.3} onClick={() => setPicker(true)}>+ Exercise</Btn>
        <Btn onClick={() => setCardio({ n: Date.now() })}>+ Cardio</Btn>
      </div>
      <div className="t-13 muted ta-center num">{doneSets} working sets done · {fmtInt(workoutVolume(w))} kg volume{sessionPRs ? ` · ${sessionPRs} PR` : ''}</div>

      {rest != null && active && (
        <div className="glass" style={{ position: 'sticky', bottom: 16, borderRadius: 22, padding: '10px 10px 10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
          <span className="stack"><span className="cap">Rest</span><span className="num big-num" style={{ color: restLeft > 0 ? C.text : C.green }}>{restLeft > 0 ? fmtClock(restLeft) : `+${fmtClock(-restLeft)}`}</span></span>
          <Btn sm onClick={() => setRest(null)}>Dismiss</Btn>
        </div>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => addExercise(e.id)} kind="strength" />
      <CardioSheet key={cardio?.n ?? 0} open={!!cardio} onClose={() => setCardio(null)} initial={cardio?.initial} onSave={upsertCardio}
        onRemove={() => cardio?.initial && update((x) => ({ ...x, cardio: x.cardio.filter((y) => y.id !== cardio.initial!.id) }))} />
      <FinishSheet open={finish} onClose={() => setFinish(false)} w={w} prCount={sessionPRs} active={active} onDelete={() => void del()}
        onSave={(p) => { update((x) => ({ ...x, ...p })); flush(); setFinish(false); if (active) { toast('Session saved'); nav('/train', { replace: true }); } }} />
    </div>
  );
}

function FinishSheet({ open, onClose, w, prCount, active, onSave, onDelete }: {
  open: boolean; onClose: () => void; w: Workout; prCount: number; active: boolean; onSave: (p: Partial<Workout>) => void; onDelete: () => void;
}) {
  const [out, setOut] = useState(w.checkOut ?? Date.now());
  const [rating, setRating] = useState<number | undefined>(w.rating);
  const [note, setNote] = useState(w.note ?? '');
  const [seen, setSeen] = useState(false);
  if (open && !seen) { setSeen(true); setOut(w.checkOut ?? Date.now()); setRating(w.rating); setNote(w.note ?? ''); }
  if (!open && seen) setSeen(false);
  const dur = Math.max(0, Math.round((out - w.checkIn) / 60000));
  const sets = w.sets.filter(isWork).length;
  return (
    <Sheet open={open} onClose={onClose} title={active ? 'Finish session' : 'Session details'} tall action={{ label: 'Save', onClick: () => onSave({ checkOut: out, rating, note: note.trim() || undefined }) }}>
      <div className="grid3">
        {([['Duration', fmtDuration(dur)], ['Volume', `${fmtInt(workoutVolume(w))} kg`], ['Sets', String(sets)]] as const).map(([l, v]) => (
          <div key={l} className="glass-btn stack g2" style={{ borderRadius: 14, padding: 10 }}><span className="t-11 b600 muted" style={{ textTransform: 'uppercase' }}>{l}</span><span className="num b700 t-17">{v}</span></div>
        ))}
      </div>
      {prCount > 0 && <div className="t-15 b600" style={{ color: C.yellow }}>{prCount} new PR{prCount > 1 ? 's' : ''}</div>}
      <DateTimeField label="Check-out" value={out} tz={w.tzOffsetMin} onChange={setOut} />
      <div className="glass-btn field">
        <span className="lbl">Rating {rating ? `· ${rating}/10` : '· not set'}</span>
        <input type="range" className="range" min={1} max={10} step={1} value={rating ?? 5} aria-label="Session rating" onChange={(e) => setRating(Number(e.target.value))} />
      </div>
      {rating != null && <button type="button" className="link" onClick={() => setRating(undefined)}>Clear rating</button>}
      <TextField label="Note" value={note} onChange={setNote} multiline rows={3} />
      <Btn block tint={C.red} tintA={0.45} onClick={() => onSave({ checkOut: out, rating, note: note.trim() || undefined })}>{active ? 'Save session' : 'Save'}</Btn>
      <Btn className="danger" onClick={onDelete}>Delete session</Btn>
      {workoutMinutes(w) > 0 && !active && <div className="t-12 muted ta-center">Logged duration {fmtDuration(workoutMinutes(w))}</div>}
    </Sheet>
  );
}
