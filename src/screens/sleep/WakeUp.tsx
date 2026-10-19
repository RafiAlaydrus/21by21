import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Btn, DateTimeField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { db } from '../../db/schema';
import { delMeta, newRec, setMeta, tzNow } from '../../db/ops';
import { dayKey, durationMin, fmtTime, sleepDayKey } from '../../logic/dates';
import { fmtDay, fmtDuration } from '../../logic/format';
import { mean } from '../../logic/stats';
import type { Sleep } from '../../db/types';
import { C } from '../../theme';

const STARS: [number, number, number, number][] = [[40, 120, 2, 0.6], [300, 90, 2, 0.5], [330, 220, 1.5, 0.5], [80, 260, 1.5, 0.4], [180, 70, 1.5, 0.45], [350, 330, 2, 0.35]];

/** The only screen shown while a sleep is active (PLAN §5.3). */
export default function WakeUp() {
  const { activeSleep: a, sleeps, settings } = useData();
  const nav = useNavigate();
  const toast = useToast();
  const now = useNow(5000);
  const [wakeOpen, setWakeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [end, setEnd] = useState(Date.now());
  const [start, setStart] = useState(a?.start ?? Date.now());
  if (!a) return null;

  const elapsed = Math.max(0, Math.floor((now - a.start) / 60000));
  const night = a.kind === 'night';
  const nights = sleeps.filter((s) => s.kind === 'night' && s.end).sort((x, y) => y.start - x.start).slice(0, 7);
  const avg = mean(nights.map((s) => s.durationMin ?? 0));
  const sinceDay = fmtDay(dayKey(a.start, a.tzOffsetMin), 'EEEE d MMM');
  const tz = tzNow();

  const save = async () => {
    const dur = durationMin(a.start, end);
    const rec = newRec({
      kind: a.kind, start: a.start, end, tzOffsetMin: a.tzOffsetMin, endTzOffsetMin: tz, durationMin: dur,
      dayKey: sleepDayKey(a.kind, a.start, a.tzOffsetMin, settings.sleepNightCutoffHour),
    }, true) as Sleep;
    await db.sleeps.put(rec);
    await delMeta('activeSleep');
    setWakeOpen(false);
    nav('/', { replace: true });
    toast(`Saved · ${fmtDuration(dur)}`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
      <div aria-hidden="true" className="glow" style={{ left: '50%', top: '42%', width: 380, height: 380, marginLeft: -190, background: C.purple, opacity: 0.3, filter: 'blur(110px)' }} />
      {STARS.map(([x, y, s, o], i) => <div key={i} aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: 1, background: '#fff', opacity: o }} />)}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: 'calc(var(--safe-t) + 80px) 24px calc(var(--safe-b) + 40px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="stack col-center g10 ta-center">
          <Icon name={night ? 'moon' : 'sun'} size={34} sw={1.8} color={C.purpleLight} />
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, color: C.purpleLight }}>{night ? 'NIGHT SLEEP' : 'NAP'}</div>
          <div className="num" style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{fmtDuration(elapsed)}</div>
          <div className="num light" style={{ fontSize: 15 }}>{night ? 'Asleep since' : 'Napping since'} {fmtTime(a.start, a.tzOffsetMin)} · {sinceDay}</div>
        </div>

        <button type="button" className="glass-btn wake-btn" onClick={() => { setEnd(Date.now()); setWakeOpen(true); }} aria-label="Wake up">
          <Icon name="sun" size={40} sw={1.8} color="#F5F5F7" />
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>WAKE UP</span>
        </button>

        <div className="stack col-center g10">
          {avg != null && <div className="num muted t-13">Last {nights.length} night{nights.length === 1 ? '' : 's'} avg {fmtDuration(avg)}</div>}
          <button type="button" className="light" style={{ fontSize: 15, padding: '10px 14px', minHeight: 44 }} onClick={() => { setStart(a.start); setEditOpen(true); }}>Edit sleep start time</button>
        </div>
      </div>

      <Sheet open={wakeOpen} onClose={() => setWakeOpen(false)} title="Wake up">
        <DateTimeField label="Woke up" value={end} tz={tz} onChange={setEnd} />
        <div className="t-13 muted ta-center">{end > a.start ? `${fmtDuration(durationMin(a.start, end))} asleep` : 'Wake time must be after the sleep start'}</div>
        <Btn block tint={C.purple} tintA={0.5} disabled={end <= a.start} onClick={() => void save()}>Save</Btn>
      </Sheet>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Sleep start" action={{ label: 'Save', disabled: start > Date.now(), color: C.purpleLight, onClick: async () => { await setMeta('activeSleep', { ...a, start }); setEditOpen(false); } }}>
        <DateTimeField label="Fell asleep" value={start} tz={a.tzOffsetMin} onChange={setStart} />
        {start > Date.now() && <div className="t-13 muted ta-center">Start time cannot be in the future</div>}
      </Sheet>
    </div>
  );
}
