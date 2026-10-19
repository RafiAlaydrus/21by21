import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { BodyMap, SORE_COLORS, SORE_LABEL, SORE_MUSCLES } from '../../components/BodyMap';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { upsertDaily } from '../../db/ops';
import { logDay } from '../../hooks/useLogTime';
import { fmtDayWd } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { SorenessRec } from '../../db/types';

export default function SorenessLogger({ open, onClose, dayKey }: LoggerProps) {
  const { soreness, today } = useData();
  const day = logDay(dayKey);
  const ex = soreness.find((s) => s.dayKey === day);
  const [v, setV] = useState<Record<string, 0 | 1 | 2 | 3>>(ex?.muscles ?? {});
  const tap = (m: string) => setV((x) => ({ ...x, [m]: (((x[m] ?? 0) + 1) % 4) as 0 | 1 | 2 | 3 }));
  const save = async () => {
    const muscles = Object.fromEntries(Object.entries(v).filter(([, l]) => l > 0)) as Record<string, 0 | 1 | 2 | 3>;
    await upsertDaily<SorenessRec>(db.soreness, `soreness:${day}`, { dayKey: day, muscles });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Soreness${day === today ? '' : ` · ${fmtDayWd(day)}`}`} tall action={{ label: 'Save', onClick: () => void save() }}>
      <div className="t-13 muted ta-center">Tap a muscle to cycle none → light → medium → high</div>
      <BodyMap vals={v} onTap={tap} />
      <div className="row wrap g6" style={{ justifyContent: 'center' }}>
        {SORE_LABEL.map((l, i) => <span key={l} className="row g4 t-12 muted"><span className="dot" style={{ background: SORE_COLORS[i] }} />{l}</span>)}
      </div>
      <div className="grid2">
        {SORE_MUSCLES.map((m) => (
          <button key={m} type="button" className="glass-btn row between" style={{ borderRadius: 14, padding: '8px 12px', minHeight: 44 }} onClick={() => tap(m)}>
            <span className="t-15">{m}</span><span className="row g6 t-12 muted"><span className="dot" style={{ background: SORE_COLORS[v[m] ?? 0] }} />{SORE_LABEL[v[m] ?? 0]}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
