import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, NumField, TimePill } from './ui';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { useData } from '../hooks/useData';
import { useDay } from '../hooks/useAnalysis';
import { useLogger } from '../hooks/useLogger';
import { useBlobUrl } from '../db/photos';
import { db } from '../db/schema';
import { saveRec, tzNow } from '../db/ops';
import { buildTimeline } from '../logic/timeline';
import type { TLEvent } from '../logic/timeline';
import { epochFor, fmtTime } from '../logic/dates';
import type { SupplementLog } from '../db/types';

function Thumb({ id }: { id: string }) {
  const url = useBlobUrl(id, 'thumb');
  return <div className="photo-ph" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, background: '#2C2C2E' }}>{url ? <img src={url} alt="" /> : <span style={{ fontSize: 10 }}>Meal<br />photo</span>}</div>;
}

/** Everything logged on `day` in time order. Tap a row to open / edit it. */
export function Timeline({ day, empty = 'Nothing logged yet' }: { day: string; empty?: string }) {
  const nav = useNavigate();
  const d = useData();
  const { open } = useLogger();
  const { agg, an } = useDay(day);
  const [supp, setSupp] = useState<SupplementLog | null>(null);
  const events = buildTimeline(d, day, agg, an.prs, tzNow());

  const act = (e: TLEvent) => {
    switch (e.kind) {
      case 'meal': return nav(`/eat/meal/${e.refId}`);
      case 'workout': return nav(`/train/session/${e.refId}`);
      case 'water': return nav(`/water?day=${day}`);
      case 'drink': return open('drink', { id: e.refId, dayKey: day });
      case 'supp': return setSupp(d.supplementLogs.find((s) => s.id === e.refId) ?? null);
      case 'craving': return open('craving', { id: e.refId });
      case 'checkin': return open('checkin', { dayKey: day });
      case 'weighin': return open('weighin', { id: e.refId });
      case 'note': return open('note', { dayKey: day });
      case 'reminder': return open('reminder', { id: e.refId });
      default: return open('sleep', { id: e.refId });
    }
  };

  if (!events.length) return <div className="muted t-15" style={{ padding: '6px 0' }}>{empty}</div>;
  return (
    <div className="stack">
      {events.map((e) => (
        <button key={e.id} type="button" className="timeline-row" onClick={() => act(e)}>
          <span className="t num">{fmtTime(e.time, e.tz)}</span>
          <span className="d"><i style={{ background: e.color }} /></span>
          <span className="row g12 grow" style={{ alignItems: 'center' }}>
            {e.photoId && <Thumb id={e.photoId} />}
            <span className="stack" style={{ minWidth: 0 }}>
              <span className="t-15 b600" style={{ textDecoration: e.done ? 'line-through' : undefined }}>{e.title}{e.late && <span className="edited-late">edited later</span>}</span>
              {e.sub && <span className="num t-13 muted clip">{e.sub}</span>}
            </span>
          </span>
        </button>
      ))}
      <SuppLogSheet log={supp} onClose={() => setSupp(null)} />
    </div>
  );
}

function SuppLogSheet({ log, onClose }: { log: SupplementLog | null; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<number | undefined>();
  const [time, setTime] = useState('00:00');
  const [seen, setSeen] = useState<string | null>(null);
  if (log && seen !== log.id) { setSeen(log.id); setAmount(log.amount); setTime(fmtTime(log.time, log.tzOffsetMin)); }
  return (
    <Sheet open={!!log} onClose={onClose} title={log?.name ?? 'Supplement'} action={{ label: 'Save', disabled: !amount, onClick: async () => { if (log && amount) await saveRec(db.supplementLogs, { ...log, amount, time: epochFor(fmtDayKey(log), time, log.tzOffsetMin) }); onClose(); } }}>
      <NumField label={`Amount${log ? ` (${log.unit})` : ''}`} value={amount} onChange={setAmount} big />
      <div className="row between"><span>Time</span><TimePill value={time} onChange={setTime} /></div>
      <Btn className="danger" onClick={async () => { if (!log) return; await db.supplementLogs.delete(log.id); onClose(); toast('Entry deleted', { undo: () => void db.supplementLogs.put(log) }); }}>Delete</Btn>
    </Sheet>
  );
}
const fmtDayKey = (l: SupplementLog) => l.dayKey;
