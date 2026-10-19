import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, Empty, NumField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { logSupplement } from '../../db/actions';
import { logDay } from '../../hooks/useLogTime';
import { fmt1 } from '../../logic/format';
import { SupplementForm } from './SupplementForm';
import type { LoggerProps } from '../../hooks/useLogger';
import type { Supplement } from '../../db/types';
import { C } from '../../theme';

/** 1-tap rows: tapping logs the default amount now. The chevron opens amount / unit / timing for that log. */
export default function SupplementLogger({ open, onClose, dayKey }: LoggerProps) {
  const { supplements, supplementLogs, settings } = useData();
  const toast = useToast();
  const day = logDay(dayKey);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [amt, setAmt] = useState<number | undefined>();
  const [unit, setUnit] = useState('');
  const [tag, setTag] = useState<string | undefined>();

  const log = async (s: Supplement, custom?: boolean) => {
    const rec = await logSupplement(s, { dayKey, ...(custom ? { amount: amt ?? s.defaultAmount, unit: unit || s.unit, timingTag: tag } : {}) });
    toast(`${s.name} ${fmt1(rec.amount)} ${rec.unit} logged`, { undo: () => void db.supplementLogs.delete(rec.id) });
    setExpanded(null);
  };
  const expand = (s: Supplement) => {
    if (expanded === s.id) { setExpanded(null); return; }
    setExpanded(s.id); setAmt(s.defaultAmount); setUnit(s.unit); setTag(s.timingTag);
  };

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'New supplement' : 'Supplement'} tall closeLabel={creating ? 'Back' : 'Close'}>
      {creating ? (
        <SupplementForm onSaved={() => setCreating(false)} />
      ) : (
        <>
          {supplements.length === 0 && <Empty title="No supplements yet" sub="Add the ones you take. Amounts, units and timing are yours to set." />}
          <div className="stack g8">
            {supplements.map((s) => {
              const count = supplementLogs.filter((l) => l.dayKey === day && l.supplementId === s.id).length;
              return (
                <div key={s.id} className="glass-btn" style={{ borderRadius: 18, overflow: 'hidden' }}>
                  <div className="row" style={{ minHeight: 56 }}>
                    <button type="button" className="grow row between" style={{ padding: '10px 14px', textAlign: 'left', minHeight: 56 }} onClick={() => void log(s)}>
                      <span className="stack"><span className="t-17 b600">{s.name}</span><span className="t-13 muted">{fmt1(s.defaultAmount)} {s.unit}{s.timingTag ? ` · ${s.timingTag}` : ''}</span></span>
                      {count > 0 && <span className="tag l" style={{ color: C.cyan, background: 'rgba(100,210,255,0.2)' }}>×{count} today</span>}
                    </button>
                    <button type="button" aria-label={`Change amount for ${s.name}`} className="icon-btn" onClick={() => expand(s)}><Icon name="down" size={18} /></button>
                  </div>
                  {expanded === s.id && (
                    <div className="stack g10" style={{ padding: '4px 14px 14px' }}>
                      <NumField label="Amount" value={amt} onChange={setAmt} />
                      <div className="row wrap g8">{settings.supplementUnits.map((u) => <Chip key={u} sm on={unit === u} onClick={() => setUnit(u)}>{u}</Chip>)}</div>
                      <Cap>Timing</Cap>
                      <div className="row wrap g8">
                        <Chip sm on={!tag} onClick={() => setTag(undefined)}>None</Chip>
                        {settings.timingTags.map((t) => <Chip key={t} sm on={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}
                      </div>
                      <Btn tint={C.cyan} disabled={!amt} onClick={() => void log(s, true)}>Log</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Btn onClick={() => setCreating(true)}>+ New supplement</Btn>
        </>
      )}
    </Sheet>
  );
}
