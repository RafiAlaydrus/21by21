import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { NumField } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { upsertDaily } from '../../db/ops';
import { logDay } from '../../hooks/useLogTime';
import { fmt1, fmtDayWd } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { Measurement } from '../../db/types';

/** One input per body part from Settings (cm, 1 decimal), with the previous value shown beside each. */
export default function MeasurementsLogger({ open, onClose, dayKey }: LoggerProps) {
  const { measurements, settings, today } = useData();
  const day = logDay(dayKey);
  const ex = measurements.find((m) => m.dayKey === day);
  const prev = [...measurements].filter((m) => m.dayKey < day).sort((a, b) => b.dayKey.localeCompare(a.dayKey))[0];
  const [v, setV] = useState<Record<string, number | undefined>>(ex?.values ?? {});
  const save = async () => {
    const values = Object.fromEntries(Object.entries(v).filter(([, n]) => n != null && n > 0)) as Record<string, number>;
    await upsertDaily<Measurement>(db.measurements, `measurements:${day}`, { dayKey: day, values });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Measurements${day === today ? '' : ` · ${fmtDayWd(day)}`}`} tall action={{ label: 'Save', onClick: () => void save() }}>
      {prev && <div className="t-13 muted">Previous: {fmtDayWd(prev.dayKey)}</div>}
      {settings.bodyParts.length === 0 && <div className="empty"><div className="b600">No body parts set</div><div className="t-13 muted">Add them in Settings.</div></div>}
      <div className="grid2">
        {settings.bodyParts.map((b) => (
          <div key={b.id} className="stack g4">
            <NumField label={b.name} unit="cm" value={v[b.id]} onChange={(n) => setV({ ...v, [b.id]: n })} />
            <span className="num t-12 muted" style={{ paddingLeft: 6 }}>{prev?.values[b.id] != null ? `Previous ${fmt1(prev.values[b.id])} cm` : 'No previous'}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
