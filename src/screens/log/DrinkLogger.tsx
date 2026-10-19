import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, NumField, TextField, TimePill } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { addDrink } from '../../db/actions';
import { newRec, saveRec, tzNow } from '../../db/ops';
import { epochFor, fmtTime } from '../../logic/dates';
import { defaultLogTime, logDay } from '../../hooks/useLogTime';
import { fmtInt } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { DrinkType } from '../../db/types';
import { C } from '../../theme';

/** Any drink that is not plain water. Never counts toward the water target. */
export default function DrinkLogger({ open, onClose, id, dayKey }: LoggerProps) {
  const { drinks, drinkTypes } = useData();
  const toast = useToast();
  const existing = id ? drinks.find((d) => d.id === id) : undefined;
  const [typeId, setTypeId] = useState<string | undefined>(existing?.drinkTypeId);
  const [ml, setMl] = useState<number | undefined>(existing?.ml);
  const base = existing?.time ?? defaultLogTime(dayKey);
  const tz = existing?.tzOffsetMin ?? tzNow();
  const [time, setTime] = useState(fmtTime(base, tz));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [n, setN] = useState<{ kcal?: number; protein?: number; carbs?: number; fat?: number }>({});

  const createType = async () => {
    if (!name.trim()) return;
    const hasN = Object.values(n).some((v) => v != null);
    const rec = newRec({ name: name.trim(), per100ml: hasN ? { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0 } : undefined }) as DrinkType;
    await db.drinkTypes.put(rec);
    setTypeId(rec.id); setCreating(false); setName(''); setN({});
  };

  const save = async () => {
    if (!ml) return;
    const day = existing?.dayKey ?? logDay(dayKey);
    const t = epochFor(day, time, tz);
    if (existing) await saveRec(db.drinks, { ...existing, ml, drinkTypeId: typeId, time: t });
    else {
      const rec = await addDrink({ kind: 'other', ml, drinkTypeId: typeId, dayKey: day, time: t });
      toast(`${drinkTypes.find((d) => d.id === typeId)?.name ?? 'Drink'} ${fmtInt(ml)} ml added`, { undo: () => void db.drinks.delete(rec.id) });
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Edit drink' : 'Log drink'} tall
      action={{ label: 'Save', disabled: !ml || creating, onClick: () => void save() }}>
      <div className="t-13 muted">Not counted in water. Plain water is logged on the Water screen.</div>
      <Cap>Drink</Cap>
      <div className="row wrap g8">
        {drinkTypes.map((d) => <Chip key={d.id} on={typeId === d.id} onClick={() => setTypeId(typeId === d.id ? undefined : d.id)}>{d.name}</Chip>)}
        <Chip onClick={() => setCreating(!creating)} className="light">+ New</Chip>
      </div>
      {creating && (
        <div className="stack g8 glass inner">
          <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Latte" />
          <Cap>Per 100 ml (optional)</Cap>
          <div className="grid2">
            <NumField label="kcal" value={n.kcal} onChange={(v) => setN({ ...n, kcal: v })} />
            <NumField label="Protein g" value={n.protein} onChange={(v) => setN({ ...n, protein: v })} />
            <NumField label="Carbs g" value={n.carbs} onChange={(v) => setN({ ...n, carbs: v })} />
            <NumField label="Fat g" value={n.fat} onChange={(v) => setN({ ...n, fat: v })} />
          </div>
          <Btn tint={C.blue} disabled={!name.trim()} onClick={() => void createType()}>Add drink type</Btn>
        </div>
      )}
      <NumField label="Amount" unit="ml" mode="numeric" big value={ml} onChange={setMl} />
      <div className="row between"><span>Time</span><TimePill value={time} onChange={setTime} /></div>
      {existing && <Btn className="danger" onClick={async () => { await db.drinks.delete(existing.id); onClose(); toast('Drink deleted', { undo: () => void db.drinks.put(existing) }); }}>Delete</Btn>}
    </Sheet>
  );
}
