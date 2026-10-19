import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Card, Cap, NumField, Page, TimePill } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { SwipeRow } from '../../components/SwipeRow';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useLogger } from '../../hooks/useLogger';
import { db } from '../../db/schema';
import { addDrink } from '../../db/actions';
import { saveRec } from '../../db/ops';
import { dayKey as dayKeyOf, epochFor, fmtTime, pad, parts } from '../../logic/dates';
import { agoText, fmtDayWd, fmtDuration, fmtInt } from '../../logic/format';
import { mean, sum } from '../../logic/stats';
import { defaultLogTime } from '../../hooks/useLogTime';
import type { Drink } from '../../db/types';
import { C } from '../../theme';

const lastKey = 'lastWaterMl';
const readLast = (): number | undefined => { try { const v = Number(localStorage.getItem(lastKey)); return v > 0 ? v : undefined; } catch { return undefined; } };

export default function Water() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { open } = useLogger();
  const { drinks, settings, today } = useData();
  const now = useNow(30000);
  const day = sp.get('day') ?? today;
  const [amount, setAmount] = useState<number | undefined>(readLast);
  const [timeStr, setTimeStr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Drink | null>(null);

  const list = useMemo(() => drinks.filter((d) => d.dayKey === day && d.kind === 'water').sort((a, b) => b.time - a.time), [drinks, day]);
  const total = sum(list.map((d) => d.ml));
  const t = settings.targets.water;
  const target = t.enabled && t.value > 0 ? t.value : 0;
  const left = target - total;
  const fill = target ? Math.min(1, total / target) : 0;
  const last = list[0];
  const nowStr = `${pad(parts(now, new Date(now).getTimezoneOffset()).h)}:${pad(parts(now, new Date(now).getTimezoneOffset()).mi)}`;

  const timeFor = () => (timeStr ? epochFor(day, timeStr, new Date().getTimezoneOffset()) : defaultLogTime(day));
  const add = async (ml: number) => {
    const rec = await addDrink({ kind: 'water', ml, dayKey: day, time: timeFor() });
    toast(`Water ${fmtInt(ml)} ml added`, { undo: () => void db.drinks.delete(rec.id) });
  };

  const byHour = useMemo(() => {
    const h = new Array<number>(18).fill(0);
    for (const d of list) h[Math.min(17, Math.max(0, parts(d.time, d.tzOffsetMin).h - 6))] += d.ml;
    return h;
  }, [list]);
  const maxH = Math.max(1, ...byHour);
  const gaps = list.length > 1 ? list.slice(0, -1).map((d, i) => (d.time - list[i + 1].time) / 60000) : [];
  const avgGap = mean(gaps);

  return (
    <Page title="Water" sub={day === today ? 'Plain water only' : `Plain water only · ${fmtDayWd(day)}`} noTabs
      glows={[{ color: C.blue, top: 80, left: 15, size: 360, opacity: 0.26, blur: 110 }]}>
      <section aria-label="Water today" className="row g12" style={{ gap: 22, padding: '8px 4px' }}>
        <div style={{ position: 'relative', width: 120, height: 190, borderRadius: '22px 22px 34px 34px', border: '1.5px solid rgba(255,255,255,0.22)', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} role="img" aria-label={target ? `${Math.round(fill * 100)} percent of target` : 'Water glass'}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${fill * 100}%`, background: C.blue, opacity: 0.85, transition: 'height 300ms ease-out' }} />
          {fill > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${fill * 100}%`, height: 2, background: C.cyan }} />}
          <div style={{ position: 'absolute', left: 10, top: 10, bottom: 10, width: 8, borderRadius: 4, background: 'rgba(255,255,255,0.14)' }} />
        </div>
        <div className="stack g6">
          <div className="xl-num num">{fmtInt(total)}</div>
          {target > 0 && <div className="num muted t-17">of {fmtInt(target)} ml</div>}
          {target > 0 && <div className="num b600" style={{ color: C.cyan, marginTop: 6 }}>{left > 0 ? `${fmtInt(left)} ml left` : `Target reached · +${fmtInt(-left)} ml`}</div>}
          {!target && <div className="num muted t-17">ml</div>}
          {last && day === today && <div className="num muted t-13">Last drink {agoText(now - last.time)}</div>}
        </div>
      </section>

      <Card aria-label="Add water">
        <div className="row between baseline">
          <Cap>Quick add</Cap>
          <button type="button" className="link" style={{ fontSize: 13 }} onClick={() => nav('/settings?s=water')}>Edit in Settings</button>
        </div>
        {settings.quickWater.length === 0 ? (
          <div className="empty"><div className="b600">No quick buttons yet</div><div className="t-13 muted">Add your glass and bottle sizes in Settings</div></div>
        ) : (
          <div className="grid3">
            {settings.quickWater.map((q) => (
              <Btn key={q.id} tint={C.blue} tintA={0.28} onClick={() => void add(q.ml)} style={{ flexDirection: 'column', gap: 0, borderRadius: 16, padding: '8px 4px' }}>
                <span className="t-13 b600 clip" style={{ maxWidth: '100%' }}>{q.label}</span><span className="num t-12 light">{fmtInt(q.ml)} ml</span>
              </Btn>
            ))}
          </div>
        )}
        <div className="row g8">
          <NumField className="grow big" label="Amount" unit="ml" mode="numeric" value={amount} placeholder="0" onChange={setAmount} />
          <Btn tint={C.blue} tintA={0.45} disabled={!amount} style={{ borderRadius: 16, padding: '0 22px', fontSize: 17, fontWeight: 700, minHeight: 56 }}
            onClick={() => { if (!amount) return; try { localStorage.setItem(lastKey, String(amount)); } catch { /* ignore */ } void add(amount); }}>Add</Btn>
        </div>
        <div className="row g8 t-13 muted">
          <span className="num">Time: {timeStr ? timeStr : `now (${nowStr})`}</span>
          <TimePill value={timeStr ?? nowStr} onChange={setTimeStr} />
          {timeStr && <button type="button" className="link" style={{ fontSize: 13 }} onClick={() => setTimeStr(null)}>Use now</button>}
        </div>
      </Card>

      <button type="button" className="glass-btn row between" style={{ borderRadius: 18, padding: '14px 16px', minHeight: 52, textAlign: 'left' }} onClick={() => open('drink', { dayKey: day })}>
        <span className="stack g2"><span className="b600">Log another drink</span><span className="t-12 muted">Coffee, tea, whey… not counted in water</span></span>
        <span className="t-17 muted">›</span>
      </button>

      <Card aria-label="Water by hour">
        <div className="row between baseline"><Cap>By hour</Cap>{avgGap != null && <span className="num t-12 muted">avg gap {fmtDuration(avgGap)}</span>}</div>
        <div role="img" aria-label="Water by hour of day" style={{ display: 'grid', gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gap: 3, alignItems: 'end', height: 80 }}>
          {byHour.map((v, i) => <span key={i} style={{ height: `${Math.max(4, (v / maxH) * 100)}%`, borderRadius: 3, background: v ? C.blue : 'rgba(255,255,255,0.1)' }} />)}
        </div>
        <div className="row between t-11 muted"><span>06</span><span>10</span><span>14</span><span>18</span><span>23</span></div>
      </Card>

      <Card aria-label="Today's water log" className="flat" style={{ padding: '4px 16px' }}>
        {list.length === 0 && <div className="muted" style={{ padding: '14px 0' }}>No water logged</div>}
        {list.map((d) => (
          <SwipeRow key={d.id} onTap={() => setEdit(d)} onDelete={async () => { await db.drinks.delete(d.id); toast('Entry deleted', { undo: () => void db.drinks.put(d) }); }}>
            <div className="rowline num" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{fmtTime(d.time, d.tzOffsetMin)}{d.editedLate && <span className="edited-late">edited later</span>}</span>
              <span className="b600">{fmtInt(d.ml)} ml</span>
            </div>
          </SwipeRow>
        ))}
      </Card>

      <EditWater drink={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

function EditWater({ drink, onClose }: { drink: Drink | null; onClose: () => void }) {
  const toast = useToast();
  const [ml, setMl] = useState<number | undefined>();
  const [time, setTime] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  if (drink && seen !== drink.id) { setSeen(drink.id); setMl(drink.ml); setTime(fmtTime(drink.time, drink.tzOffsetMin)); }
  const save = async () => {
    if (!drink || !ml) return;
    await saveRec(db.drinks, { ...drink, ml, time: epochFor(dayKeyOf(drink.time, drink.tzOffsetMin), time, drink.tzOffsetMin) });
    onClose();
  };
  return (
    <Sheet open={!!drink} onClose={onClose} title="Edit water" action={{ label: 'Save', disabled: !ml, onClick: () => void save() }}>
      <NumField label="Amount" unit="ml" mode="numeric" big value={ml} onChange={setMl} />
      <div className="row between"><span>Time</span><TimePill value={time || '00:00'} onChange={setTime} /></div>
      <Btn className="danger" onClick={async () => { if (!drink) return; await db.drinks.delete(drink.id); onClose(); toast('Entry deleted', { undo: () => void db.drinks.put(drink) }); }}>Delete</Btn>
    </Sheet>
  );
}
