import { useState } from 'react';
import { Btn, Cap, Chip, NumField, TextField, ToggleRow } from '../../components/ui';
import { useSettings } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec } from '../../db/ops';
import type { Supplement } from '../../db/types';
import { C } from '../../theme';

/** Create or edit a library supplement. Every field is the user's own; nothing is pre-filled with advice. */
export function SupplementForm({ initial, onSaved, onDelete }: { initial?: Supplement; onSaved: (s: Supplement) => void; onDelete?: () => void }) {
  const settings = useSettings();
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [amount, setAmount] = useState<number | undefined>(initial?.defaultAmount);
  const [unit, setUnit] = useState(initial?.unit ?? settings.supplementUnits[0] ?? 'g');
  const [tag, setTag] = useState<string | undefined>(initial?.timingTag);
  const [daily, setDaily] = useState(initial?.daily ?? false);
  const [hasN, setHasN] = useState(!!initial?.perServing);
  const [n, setN] = useState({ kcal: initial?.perServing?.kcal, protein: initial?.perServing?.protein, carbs: initial?.perServing?.carbs, fat: initial?.perServing?.fat });

  const save = async () => {
    if (!name.trim() || !amount) return;
    const fields = {
      name: name.trim(), brand: brand.trim() || undefined, defaultAmount: amount, unit, timingTag: tag, daily,
      perServing: hasN ? { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0 } : undefined,
    };
    const rec = initial ? await saveRec(db.supplements, { ...initial, ...fields }) : (newRec(fields) as Supplement);
    if (!initial) await db.supplements.put(rec);
    onSaved(rec);
  };

  return (
    <div className="stack g12">
      <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Creatine" />
      <TextField label="Brand (optional)" value={brand} onChange={setBrand} />
      <NumField label="Default amount" value={amount} onChange={setAmount} />
      <Cap>Unit</Cap>
      <div className="row wrap g8">{settings.supplementUnits.map((u) => <Chip key={u} sm on={unit === u} onClick={() => setUnit(u)}>{u}</Chip>)}</div>
      <Cap>Timing tag</Cap>
      <div className="row wrap g8">
        <Chip sm on={!tag} onClick={() => setTag(undefined)}>None</Chip>
        {settings.timingTags.map((t) => <Chip key={t} sm on={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}
      </div>
      <ToggleRow label="Daily" sub="Counts toward the daily score and “still to log”" checked={daily} onChange={setDaily} />
      <ToggleRow label="Nutrition per default amount" checked={hasN} onChange={setHasN} />
      {hasN && (
        <div className="grid2">
          <NumField label="kcal" value={n.kcal} onChange={(v) => setN({ ...n, kcal: v })} />
          <NumField label="Protein g" value={n.protein} onChange={(v) => setN({ ...n, protein: v })} />
          <NumField label="Carbs g" value={n.carbs} onChange={(v) => setN({ ...n, carbs: v })} />
          <NumField label="Fat g" value={n.fat} onChange={(v) => setN({ ...n, fat: v })} />
        </div>
      )}
      <Btn block tint={C.cyan} disabled={!name.trim() || !amount} onClick={() => void save()}>{initial ? 'Save' : 'Add to library'}</Btn>
      {onDelete && <Btn className="danger" onClick={onDelete}>Delete supplement</Btn>}
    </div>
  );
}
