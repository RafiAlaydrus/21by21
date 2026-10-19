import { useState } from 'react';
import { Btn, Cap, NumField, Segmented, TextField } from '../../components/ui';
import { db } from '../../db/schema';
import { newRec, saveRec } from '../../db/ops';
import type { Food, FoodSource, Nutrients } from '../../db/types';
import { C } from '../../theme';

type N = Partial<Nutrients>;

/** Create / edit a library food from a label. Values are per 100 g (or 100 ml). */
export function FoodForm({ initial, source = 'label', note, onSaved, onDelete, submitLabel }: {
  initial?: Partial<Food>; source?: FoodSource; note?: string; onSaved: (f: Food) => void; onDelete?: () => void; submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [basis, setBasis] = useState<'g' | 'ml'>(initial?.basis ?? 'g');
  const [n, setN] = useState<N>(initial?.per100 ?? {});
  const [barcode, setBarcode] = useState(initial?.barcode ?? '');
  const [fnote, setFnote] = useState(initial?.note ?? '');
  const set = (k: keyof Nutrients) => (v: number | undefined) => setN({ ...n, [k]: v });
  const ok = name.trim() && n.kcal != null;

  const save = async () => {
    if (!ok) return;
    const per100: Nutrients = { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0, fiber: n.fiber, sugar: n.sugar, sodiumMg: n.sodiumMg };
    const fields = { name: name.trim(), brand: brand.trim() || undefined, basis, per100, barcode: barcode.trim() || undefined, note: fnote.trim() || undefined };
    if (initial?.id) {
      // correcting a number in the library marks it as the user's own value
      const prev = initial as Food;
      const changed = JSON.stringify(prev.per100) !== JSON.stringify(per100);
      onSaved(await saveRec(db.foods, { ...prev, ...fields, source: changed && prev.source !== 'label' && prev.source !== 'barcode' ? 'user' : prev.source }));
    } else {
      const rec = newRec({ ...fields, source: initial?.source ?? source, useCount: 0, lastUsedAt: 0, defaultState: initial?.defaultState }) as Food;
      await db.foods.put(rec);
      onSaved(rec);
    }
  };

  return (
    <div className="stack g10">
      {note && <div className="t-13 muted">{note}</div>}
      <TextField label="Name" value={name} onChange={setName} />
      <TextField label="Brand (optional)" value={brand} onChange={setBrand} />
      <Segmented value={basis} onChange={setBasis} options={[{ value: 'g', label: 'Per 100 g' }, { value: 'ml', label: 'Per 100 ml' }]} />
      <div className="grid2">
        <NumField label="Calories" unit="kcal" value={n.kcal} onChange={set('kcal')} />
        <NumField label="Protein" unit="g" value={n.protein} onChange={set('protein')} />
        <NumField label="Carbs" unit="g" value={n.carbs} onChange={set('carbs')} />
        <NumField label="Fat" unit="g" value={n.fat} onChange={set('fat')} />
        <NumField label="Fiber" unit="g" value={n.fiber} onChange={set('fiber')} />
        <NumField label="Sugar" unit="g" value={n.sugar} onChange={set('sugar')} />
      </div>
      <NumField label="Sodium" unit="mg" value={n.sodiumMg} onChange={set('sodiumMg')} />
      <TextField label="Barcode (optional)" value={barcode} onChange={setBarcode} inputMode="numeric" />
      <TextField label="Note (optional)" value={fnote} onChange={setFnote} />
      <Cap>Values you enter here are used for every future meal that picks this food.</Cap>
      <Btn block tint={C.orange} tintA={0.4} disabled={!ok} onClick={() => void save()}>{submitLabel ?? (initial?.id ? 'Save' : 'Save to library')}</Btn>
      {onDelete && <Btn className="danger" onClick={onDelete}>Delete food</Btn>}
    </div>
  );
}
