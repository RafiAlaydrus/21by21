import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, DateTimeField, NumField, Segmented, Switch, TextField, TimePill } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec, tzNow, updateSettings, upsertDaily } from '../../db/ops';
import { defaultLogTime, logDay } from '../../hooks/useLogTime';
import { addDays, epochFor, fmtTime } from '../../logic/dates';
import { fmt1, fmtDayWd, fmtInt, signed } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { Checkin, CustomLog, Craving, DayNote, DayTagRec, Reminder, StepsRec, WeighIn } from '../../db/types';
import { C } from '../../theme';

const dayLabel = (day: string, today: string) => (day === today ? '' : ` · ${fmtDayWd(day)}`);

function Slider({ label, value, onChange, color = C.green }: { label: string; value: number; onChange: (n: number) => void; color?: string }) {
  return (
    <div className="glass-btn field">
      <span className="lbl row between"><span>{label}</span><span className="num" style={{ color, fontSize: 15 }}>{value}/10</span></span>
      <input type="range" className="range" min={1} max={10} step={1} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/* ---------------- craving ---------------- */
export function CravingLogger({ open, onClose, id, dayKey }: LoggerProps) {
  const { cravings, today } = useData();
  const toast = useToast();
  const ex = id ? cravings.find((c) => c.id === id) : undefined;
  const day = ex?.dayKey ?? logDay(dayKey);
  const tz = ex?.tzOffsetMin ?? tzNow();
  const [what, setWhat] = useState(ex?.what ?? '');
  const [strength, setStrength] = useState(ex?.strength ?? 5);
  const [outcome, setOutcome] = useState<'resisted' | 'ate'>(ex?.outcome ?? 'resisted');
  const [time, setTime] = useState(fmtTime(ex?.time ?? defaultLogTime(dayKey), tz));
  const [note, setNote] = useState(ex?.note ?? '');
  const recent = [...new Set([...cravings].sort((a, b) => b.time - a.time).map((c) => c.what))].slice(0, 8);
  const save = async () => {
    const fields = { dayKey: day, time: epochFor(day, time, tz), tzOffsetMin: tz, what: what.trim(), strength, outcome, note: note.trim() || undefined };
    if (ex) await saveRec(db.cravings, { ...ex, ...fields }); else await db.cravings.put(newRec(fields) as Craving);
    onClose(); toast('Craving logged');
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Craving${dayLabel(day, today)}`} tall action={{ label: 'Save', disabled: !what.trim(), onClick: () => void save() }}>
      <TextField label="What" value={what} onChange={setWhat} placeholder="e.g. chocolate" />
      {recent.length > 0 && <div className="chips-scroll">{recent.map((r) => <Chip key={r} sm on={what === r} onClick={() => setWhat(r)}>{r}</Chip>)}</div>}
      <Slider label="Strength" value={strength} onChange={setStrength} color={C.red} />
      <Segmented value={outcome} onChange={setOutcome} options={[{ value: 'resisted', label: 'Resisted' }, { value: 'ate', label: 'Ate' }]} />
      <div className="row between"><span>Time</span><TimePill value={time} onChange={setTime} /></div>
      <TextField label="Note" value={note} onChange={setNote} />
      {ex && <Btn className="danger" onClick={async () => { await db.cravings.delete(ex.id); onClose(); toast('Craving deleted', { undo: () => void db.cravings.put(ex) }); }}>Delete</Btn>}
    </Sheet>
  );
}

/* ---------------- check-in ---------------- */
export function CheckinLogger({ open, onClose, dayKey }: LoggerProps) {
  const { checkins, today } = useData();
  const toast = useToast();
  const day = logDay(dayKey);
  const ex = checkins.find((c) => c.dayKey === day);
  const [v, setV] = useState({ energy: ex?.energy ?? 5, mood: ex?.mood ?? 5, hunger: ex?.hunger ?? 5, stress: ex?.stress ?? 5, soreness: ex?.soreness ?? 5, dayRating: ex?.dayRating ?? 5 });
  const [note, setNote] = useState(ex?.note ?? '');
  const save = async () => {
    await upsertDaily<Checkin>(db.checkins, `checkin:${day}`, { dayKey: day, ...v, note: note.trim() || undefined });
    onClose(); toast('Check-in saved');
  };
  const rows: [keyof typeof v, string][] = [['energy', 'Energy'], ['mood', 'Mood'], ['hunger', 'Hunger'], ['stress', 'Stress'], ['soreness', 'Soreness'], ['dayRating', 'Day rating']];
  return (
    <Sheet open={open} onClose={onClose} title={`Check-in${dayLabel(day, today)}`} tall action={{ label: 'Save', onClick: () => void save() }}>
      {rows.map(([k, l]) => <Slider key={k} label={l} value={v[k]} onChange={(n) => setV({ ...v, [k]: n })} color={C.yellow} />)}
      <TextField label="Note" value={note} onChange={setNote} multiline rows={3} />
      {ex && <div className="t-12 muted ta-center">Editing today's saved check-in</div>}
    </Sheet>
  );
}

/* ---------------- weigh-in ---------------- */
export function WeighInLogger({ open, onClose, id, dayKey }: LoggerProps) {
  const { weighIns, today } = useData();
  const toast = useToast();
  const ex = id ? weighIns.find((w) => w.id === id) : undefined;
  const day = ex?.dayKey ?? logDay(dayKey);
  const tz = ex?.tzOffsetMin ?? tzNow();
  const [kg, setKg] = useState<number | undefined>(ex?.kg);
  const [time, setTime] = useState(fmtTime(ex?.time ?? defaultLogTime(dayKey), tz));
  const [note, setNote] = useState(ex?.note ?? '');
  const prev = [...weighIns].filter((w) => w.id !== ex?.id && w.dayKey <= day).sort((a, b) => b.dayKey.localeCompare(a.dayKey) || b.time - a.time)[0];
  const save = async () => {
    if (!kg) return;
    const fields = { dayKey: day, time: epochFor(day, time, tz), tzOffsetMin: tz, kg: Math.round(kg * 10) / 10, note: note.trim() || undefined };
    if (ex) await saveRec(db.weighIns, { ...ex, ...fields }); else await db.weighIns.put(newRec(fields) as WeighIn);
    onClose(); toast('Weigh-in saved');
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Weigh-in${dayLabel(day, today)}`} action={{ label: 'Save', disabled: !kg, onClick: () => void save() }}>
      <NumField label="Weight" unit="kg" big value={kg} onChange={setKg} />
      {prev && <div className="num t-13 muted">Previous: {fmt1(prev.kg)} kg · {fmtDayWd(prev.dayKey)}{kg ? ` · difference ${signed(kg - prev.kg)} kg` : ''}</div>}
      <div className="row between"><span>Time</span><TimePill value={time} onChange={setTime} /></div>
      <TextField label="Note" value={note} onChange={setNote} />
      {ex && <Btn className="danger" onClick={async () => { await db.weighIns.delete(ex.id); onClose(); toast('Weigh-in deleted', { undo: () => void db.weighIns.put(ex) }); }}>Delete</Btn>}
    </Sheet>
  );
}

/* ---------------- steps ---------------- */
export function StepsLogger({ open, onClose, dayKey }: LoggerProps) {
  const { steps, today } = useData();
  const day = logDay(dayKey);
  const ex = steps.find((s) => s.dayKey === day);
  const prev = steps.find((s) => s.dayKey === addDays(day, -1));
  const [n, setN] = useState<number | undefined>(ex?.steps);
  return (
    <Sheet open={open} onClose={onClose} title={`Steps${dayLabel(day, today)}`} action={{ label: 'Save', disabled: n == null, onClick: async () => { await upsertDaily<StepsRec>(db.steps, `steps:${day}`, { dayKey: day, steps: Math.round(n ?? 0) }); onClose(); } }}>
      <NumField label="Steps" big mode="numeric" value={n} onChange={setN} />
      {prev && <div className="num t-13 muted">Previous day: {fmtInt(prev.steps)}</div>}
      <div className="t-12 muted">Entered by hand; a web app cannot read Apple Health.</div>
    </Sheet>
  );
}

/* ---------------- day tags ---------------- */
export function TagLogger({ open, onClose, dayKey }: LoggerProps) {
  const { dayTags, settings, today } = useData();
  const day = logDay(dayKey);
  const ex = dayTags.find((t) => t.dayKey === day);
  const [sel, setSel] = useState<string[]>(ex?.tags ?? []);
  const [fresh, setFresh] = useState('');
  const all = [...new Set([...settings.dayTags, ...sel])];
  const toggle = (t: string) => setSel(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
  const add = async () => {
    const t = fresh.trim(); if (!t) return;
    if (!settings.dayTags.includes(t)) await updateSettings((s) => { s.dayTags.push(t); });
    if (!sel.includes(t)) setSel([...sel, t]);
    setFresh('');
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Tag day${dayLabel(day, today)}`} action={{ label: 'Save', onClick: async () => { await upsertDaily<DayTagRec>(db.dayTags, `dayTags:${day}`, { dayKey: day, tags: sel }); onClose(); } }}>
      <div className="row wrap g8">{all.map((t) => <Chip key={t} on={sel.includes(t)} onClick={() => toggle(t)}>{t}</Chip>)}</div>
      <div className="row g8"><TextField className="grow" label="New tag" value={fresh} onChange={setFresh} onKeyDown={(e) => e.key === 'Enter' && void add()} /><Btn disabled={!fresh.trim()} onClick={() => void add()} style={{ borderRadius: 16, minHeight: 56 }}>Add</Btn></div>
    </Sheet>
  );
}

/* ---------------- note ---------------- */
export function NoteLogger({ open, onClose, dayKey }: LoggerProps) {
  const { dayNotes, today } = useData();
  const day = logDay(dayKey);
  const ex = dayNotes.find((n) => n.dayKey === day);
  const [text, setText] = useState(ex?.text ?? '');
  return (
    <Sheet open={open} onClose={onClose} title={`Note${dayLabel(day, today)}`} tall action={{
      label: 'Save', onClick: async () => { if (text.trim()) await upsertDaily<DayNote>(db.dayNotes, `dayNotes:${day}`, { dayKey: day, text: text.trim() }); else if (ex) await db.dayNotes.delete(ex.id); onClose(); },
    }}>
      <TextField label="Note for the day" value={text} onChange={setText} multiline rows={8} autoFocus />
    </Sheet>
  );
}

/* ---------------- reminder ---------------- */
export function ReminderLogger({ open, onClose, id }: LoggerProps) {
  const { reminders } = useData();
  const toast = useToast();
  const ex = id ? reminders.find((r) => r.id === id) : undefined;
  const tz = ex?.tzOffsetMin ?? tzNow();
  const [text, setText] = useState(ex?.text ?? '');
  const [at, setAt] = useState(ex?.at ?? Math.ceil((Date.now() + 3600000) / 900000) * 900000);
  const save = async () => {
    const fields = { text: text.trim(), at, tzOffsetMin: tz, done: ex?.done ?? false };
    if (ex) await saveRec(db.reminders, { ...ex, ...fields }); else await db.reminders.put(newRec(fields) as Reminder);
    onClose(); toast('Reminder saved');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Reminder" action={{ label: 'Save', disabled: !text.trim(), onClick: () => void save() }}>
      <TextField label="Reminder" value={text} onChange={setText} autoFocus />
      <DateTimeField label="When" value={at} tz={tz} onChange={setAt} />
      <div className="t-12 muted">Shown under “Coming up” and in the timeline. There are no push notifications.</div>
      {ex && <Btn className="danger" onClick={async () => { await db.reminders.delete(ex.id); onClose(); toast('Reminder deleted', { undo: () => void db.reminders.put(ex) }); }}>Delete</Btn>}
    </Sheet>
  );
}

/* ---------------- custom tracker ---------------- */
export function CustomLogger({ open, onClose, trackerId, dayKey }: LoggerProps) {
  const { settings, customLogs, today } = useData();
  const t = settings.customTrackers.find((x) => x.id === trackerId);
  const day = logDay(dayKey);
  const ex = customLogs.find((l) => l.trackerId === trackerId && l.dayKey === day);
  const [b, setB] = useState(ex?.value === true);
  const [n, setN] = useState<number | undefined>(typeof ex?.value === 'number' ? ex.value : undefined);
  if (!t) return null;
  const save = async () => {
    await upsertDaily<CustomLog>(db.customLogs, `${t.id}:${day}`, { dayKey: day, trackerId: t.id, value: t.kind === 'boolean' ? b : n ?? 0 });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`${t.name}${dayLabel(day, today)}`} action={{ label: 'Save', disabled: t.kind === 'number' && n == null, onClick: () => void save() }}>
      {t.kind === 'boolean'
        ? <div className="toggle-row"><span className="t-17">{t.name}</span><Switch checked={b} onChange={setB} label={t.name} /></div>
        : <NumField label={t.name} unit={t.unit} big value={n} onChange={setN} />}
      <Cap>{ex ? 'Already logged — saving replaces it' : ' '}</Cap>
    </Sheet>
  );
}
