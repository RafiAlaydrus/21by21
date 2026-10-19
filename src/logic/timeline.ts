import type { AppData } from '../hooks/useData';
import type { DayAgg } from './aggregate';
import { workoutMinutes } from './aggregate';
import { dayKey as dayKeyOf, fmtTime } from './dates';
import { mealN, exactPct } from './nutrition';
import { prCountForWorkout } from './prs';
import type { PREvent } from './prs';
import { fmt1, fmtDuration, fmtInt, fmtMacro } from './format';
import { C } from '../theme';

export type TLKind = 'sleep' | 'wake' | 'nap' | 'meal' | 'water' | 'drink' | 'supp' | 'workout' | 'craving' | 'checkin' | 'weighin' | 'note' | 'reminder';
export interface TLEvent {
  id: string; kind: TLKind; time: number; tz: number; color: string; title: string; sub?: string; photoId?: string; refId?: string; late?: boolean; done?: boolean;
}

type D = Pick<AppData, 'sleeps' | 'dayNotes' | 'reminders' | 'drinkTypes' | 'exercises'>;

/** Everything logged on one day, in time order (PLAN §6.1 "Timeline"). Times use the offset each entry was logged in. */
export function buildTimeline(d: D, day: string, a: DayAgg, prs: PREvent[], tzFallback: number): TLEvent[] {
  const out: TLEvent[] = [];
  for (const s of d.sleeps) {
    if (s.end && dayKeyOf(s.end, s.endTzOffsetMin ?? s.tzOffsetMin) === day) {
      out.push(s.kind === 'night'
        ? { id: `w${s.id}`, kind: 'wake', time: s.end, tz: s.endTzOffsetMin ?? s.tzOffsetMin, color: C.purple, title: 'Woke up', sub: `Night · ${fmtDuration(s.durationMin ?? 0)}`, refId: s.id }
        : { id: `n${s.id}`, kind: 'nap', time: s.start, tz: s.tzOffsetMin, color: C.purple, title: 'Nap', sub: `${fmtTime(s.start, s.tzOffsetMin)} → ${fmtTime(s.end, s.endTzOffsetMin ?? s.tzOffsetMin)} · ${fmtDuration(s.durationMin ?? 0)}`, refId: s.id });
    }
    if (s.kind === 'night' && dayKeyOf(s.start, s.tzOffsetMin) === day)
      out.push({ id: `s${s.id}`, kind: 'sleep', time: s.start, tz: s.tzOffsetMin, color: C.purple, title: 'Went to sleep', sub: 'Night', refId: s.id });
  }
  for (const m of a.meals) {
    const n = mealN(m);
    const est = m.mode === 'bought' || exactPct(m.items) < 100 ? '≈ ' : '';
    out.push({ id: m.id, kind: 'meal', time: m.time, tz: m.tzOffsetMin, color: C.orange, title: `${m.label} · ${m.mode === 'bought' ? 'Bought' : 'Cooked'}`, sub: `${est}${fmtInt(n.kcal)} kcal · P ${est}${fmtMacro(n.protein)} g${m.clean ? ' · clean' : ''}`, photoId: m.photoId, refId: m.id, late: m.editedLate });
  }
  let run = 0;
  for (const dr of [...a.drinks].sort((x, y) => x.time - y.time)) {
    if (dr.kind === 'water') { run += dr.ml; out.push({ id: dr.id, kind: 'water', time: dr.time, tz: dr.tzOffsetMin, color: C.blue, title: `Water ${fmtInt(dr.ml)} ml`, sub: `Total ${fmtInt(run)} ml`, refId: dr.id, late: dr.editedLate }); }
    else out.push({ id: dr.id, kind: 'drink', time: dr.time, tz: dr.tzOffsetMin, color: C.blue, title: `${d.drinkTypes.find((t) => t.id === dr.drinkTypeId)?.name ?? 'Drink'} ${fmtInt(dr.ml)} ml`, sub: 'Not counted in water', refId: dr.id, late: dr.editedLate });
  }
  for (const s of a.supplementLogs) out.push({ id: s.id, kind: 'supp', time: s.time, tz: s.tzOffsetMin, color: C.cyan, title: `${s.name} ${fmt1(s.amount)} ${s.unit}`, sub: `Supplement${s.timingTag ? ` · ${s.timingTag}` : ''}`, refId: s.id, late: s.editedLate });
  for (const w of a.workouts) {
    const n = prCountForWorkout(prs, w.id);
    out.push({
      id: w.id, kind: 'workout', time: w.checkIn, tz: w.tzOffsetMin, color: C.red, title: `Gym · ${w.title || 'Workout'}`, refId: w.id, late: w.editedLate,
      sub: `${fmtTime(w.checkIn, w.tzOffsetMin)}${w.checkOut ? ` → ${fmtTime(w.checkOut, w.tzOffsetMin)} · ${fmtDuration(workoutMinutes(w))}` : ' · in progress'}${n ? ` · ${n} PR${n > 1 ? 's' : ''}` : ''}`,
    });
  }
  for (const c of a.cravings) out.push({ id: c.id, kind: 'craving', time: c.time, tz: c.tzOffsetMin, color: C.red, title: `Craving · ${c.what}`, sub: `Strength ${c.strength}/10 · ${c.outcome}`, refId: c.id, late: c.editedLate });
  if (a.checkin) out.push({ id: a.checkin.id, kind: 'checkin', time: a.checkin.updatedAt, tz: tzFallback, color: C.yellow, title: 'Check-in', sub: `Energy ${a.checkin.energy} · Mood ${a.checkin.mood} · Day ${a.checkin.dayRating}/10`, refId: a.checkin.id });
  if (a.weighIn) out.push({ id: a.weighIn.id, kind: 'weighin', time: a.weighIn.time, tz: a.weighIn.tzOffsetMin, color: '#F5F5F7', title: 'Weigh-in', sub: `${fmt1(a.weighIn.kg)} kg`, refId: a.weighIn.id });
  const note = d.dayNotes.find((n) => n.dayKey === day);
  if (note) out.push({ id: note.id, kind: 'note', time: note.updatedAt, tz: tzFallback, color: '#AEAEB2', title: 'Note', sub: note.text.slice(0, 90), refId: note.id });
  for (const r of d.reminders) if (dayKeyOf(r.at, r.tzOffsetMin) === day) out.push({ id: r.id, kind: 'reminder', time: r.at, tz: r.tzOffsetMin, color: C.yellow, title: r.text, sub: r.done ? 'Reminder · done' : 'Reminder', refId: r.id, done: r.done });
  return out.sort((x, y) => x.time - y.time);
}
