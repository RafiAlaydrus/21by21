import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, Chip, NumField, Sep, TextField, ToggleRow } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { SourceTag } from '../../components/SourceTag';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { uid } from '../../db/ops';
import { ensureFoodFromRef, searchRef, useRefFoods } from '../../db/refdb';
import type { RefFood } from '../../db/refdb';
import { lookupBarcode } from '../../db/openfoodfacts';
import { itemN } from '../../logic/nutrition';
import { norm } from '../../logic/search';
import { fmtInt, fmtMacro } from '../../logic/format';
import { FoodForm } from './FoodForm';
import type { Food, FoodSource, MealItem, Nutrients } from '../../db/types';
import { C } from '../../theme';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

interface Draft { name: string; brand?: string; basis: 'g' | 'ml'; per100: Nutrients; source: FoodSource; foodId?: string; ref?: RefFood; state?: 'raw' | 'cooked' }
type Step = 'search' | 'detail' | 'create' | 'confirm';

const fromFood = (f: Food): Draft => ({ name: f.name, brand: f.brand, basis: f.basis, per100: f.per100, source: f.source, foodId: f.id, state: f.defaultState });
const fromRef = (r: RefFood): Draft => ({ name: r.name, basis: r.basis, per100: r.per100, source: r.source, ref: r, state: r.state });
const per100Text = (n: Nutrients, basis: string) => `${fmtInt(n.kcal)} kcal · P ${fmtMacro(n.protein)} · C ${fmtMacro(n.carbs)} · F ${fmtMacro(n.fat)} /100 ${basis}`;

export function ItemSheet({ open, onClose, mode, seasoning, initial, autoScan, onSave, onRemove }: {
  open: boolean; onClose: () => void; mode: 'bought' | 'cooked'; seasoning: boolean; initial?: MealItem; autoScan?: boolean; onSave: (it: MealItem) => void; onRemove?: () => void;
}) {
  const { foods } = useData();
  const [step, setStep] = useState<Step>('search');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amount, setAmount] = useState<number | undefined>();
  const [state, setState] = useState<'raw' | 'cooked' | undefined>();
  const [estimated, setEstimated] = useState(false);
  const [isSeasoning, setIsSeasoning] = useState(seasoning);
  const [note, setNote] = useState('');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [n, setN] = useState<Partial<Nutrients>>({});
  const [overridden, setOverridden] = useState(false);
  const [showN, setShowN] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [confirmFood, setConfirmFood] = useState<{ food: Partial<Food>; note?: string; source: FoodSource } | null>(null);
  const [createSource, setCreateSource] = useState<FoodSource>('label');
  const { items: refItems, error: refErr } = useRefFoods(open);

  const pick = (d: Draft) => {
    setDraft(d); setName(d.name); setBrand(d.brand ?? ''); setN(d.per100); setOverridden(false); setShowN(false);
    setState(d.state); setAmount(undefined); setEstimated(false); setNote(''); setIsSeasoning(seasoning); setStep('detail');
  };

  useEffect(() => {
    if (!open) return;
    setQ(''); setScanMsg(''); setScanning(false);
    if (initial) {
      setDraft({ name: initial.name, brand: initial.brand, basis: initial.basis, per100: initial.per100, source: initial.source, foodId: initial.foodId, state: initial.state });
      setName(initial.name); setBrand(initial.brand ?? ''); setN(initial.per100); setOverridden(false); setShowN(false);
      setAmount(initial.amount); setState(initial.state); setEstimated(initial.estimated); setNote(initial.note ?? ''); setIsSeasoning(initial.isSeasoning);
      setStep('detail');
    } else { setDraft(null); setStep('search'); setIsSeasoning(seasoning); if (autoScan) setScanning(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const libMatches = useMemo(() => {
    const t = norm(q.trim());
    const list = t ? foods.filter((f) => norm(f.name).includes(t) || norm(f.brand ?? '').includes(t) || (f.barcode ?? '') === t) : [...foods].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, 8);
    return list.slice(0, 20);
  }, [foods, q]);
  const refMatches = useMemo(() => (q.trim().length >= 1 ? searchRef(refItems, q).filter((r) => !foods.some((f) => f.refId === r.id)) : []), [refItems, q, foods]);

  const onCode = async (code: string) => {
    setScanning(false);
    const local = foods.find((f) => f.barcode === code);
    if (local) { pick(fromFood(local)); return; }
    setScanMsg('Looking up…');
    const r = await lookupBarcode(code);
    setScanMsg('');
    if (r.found) setConfirmFood({ food: r.food, source: 'barcode', note: 'From Open Food Facts. Check every number against the label and edit anything that differs.' });
    else setConfirmFood({ food: { barcode: code }, source: 'label', note: r.offline ? 'Offline — enter the values from the label.' : 'Not found — enter from label.' });
    setStep('confirm');
  };

  const unit = draft?.basis ?? 'g';
  const eff: Nutrients = { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0, fiber: n.fiber, sugar: n.sugar, sodiumMg: n.sodiumMg };
  const live = itemN({ per100: eff, amount: amount ?? 0 });
  const isEst = mode === 'bought' ? true : estimated;

  const save = async () => {
    if (!draft || !amount) return;
    let foodId = draft.foodId;
    if (!foodId && draft.ref) foodId = (await ensureFoodFromRef(draft.ref)).id;
    const item: MealItem = {
      id: initial?.id ?? uid(), foodId, name: name.trim() || draft.name, brand: brand.trim() || undefined, amount, basis: draft.basis,
      state: mode === 'cooked' ? state : undefined, per100: eff, source: overridden ? 'user' : draft.source,
      estimated: isEst, isSeasoning, note: note.trim() || undefined,
    };
    onSave(item);
    onClose();
  };

  const title = step === 'search' ? 'Add food' : step === 'create' ? 'Create from label' : step === 'confirm' ? 'Confirm food' : initial ? 'Edit item' : 'Amount';
  const action = step === 'detail' ? { label: 'Save', disabled: !amount, onClick: () => void save() } : undefined;

  return (
    <>
      <Sheet open={open && !scanning} onClose={onClose} title={title} tall action={action}>
        {step === 'search' && (
          <>
            <TextField label="Search" value={q} onChange={setQ} placeholder="Food name or brand" autoFocus />
            <div className="grid2">
              <Btn onClick={() => setScanning(true)}><Icon name="barcode" size={18} />Scan barcode</Btn>
              <Btn onClick={() => { setCreateSource('label'); setStep('create'); }}><Icon name="plus" size={18} />From label</Btn>
            </div>
            {scanMsg && <div className="t-13 muted ta-center">{scanMsg}</div>}
            <Cap>{q.trim() ? 'Your library' : 'Recent in your library'}</Cap>
            {libMatches.length === 0 && <div className="t-13 muted">{foods.length ? 'No match in your library' : 'Your library is empty. Search the database below or create a food from a label.'}</div>}
            <div className="stack g8">
              {libMatches.map((f) => (
                <button key={f.id} type="button" className="glass-btn row between" style={{ borderRadius: 16, padding: '10px 14px', textAlign: 'left', minHeight: 56 }} onClick={() => pick(fromFood(f))}>
                  <span className="stack g2 grow"><span className="b600 clip">{f.name}</span><span className="t-12 muted clip">{f.brand ? `${f.brand} · ` : ''}{per100Text(f.per100, f.basis)}</span></span>
                  <SourceTag source={f.source} />
                </button>
              ))}
            </div>
            <Cap>Database</Cap>
            {refErr && <div className="t-13 muted">Database unavailable offline until it has loaded once.</div>}
            {!q.trim() && <div className="t-13 muted">Type to search ~200 reference foods (USDA, TKPI, MyFCD). Values are approximate and can be overridden.</div>}
            {q.trim() && refMatches.length === 0 && <div className="t-13 muted">No match in the database</div>}
            <div className="stack g8">
              {refMatches.map((r) => (
                <button key={r.id} type="button" className="glass-btn row between" style={{ borderRadius: 16, padding: '10px 14px', textAlign: 'left', minHeight: 56 }} onClick={() => pick(fromRef(r))}>
                  <span className="stack g2 grow"><span className="b600 clip">{r.name}</span><span className="t-12 muted clip">{per100Text(r.per100, r.basis)}</span></span>
                  <SourceTag source={r.source} />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'create' && <FoodForm source={createSource} onSaved={(f) => pick(fromFood(f))} />}
        {step === 'confirm' && confirmFood && <FoodForm initial={confirmFood.food} source={confirmFood.source} note={confirmFood.note} onSaved={(f) => pick(fromFood(f))} />}

        {step === 'detail' && draft && (
          <>
            <div className="row between">
              <div className="stack g2 grow"><div className="t-card clip">{draft.name}</div><div className="t-13 muted clip">{per100Text(eff, unit)}</div></div>
              <SourceTag source={overridden ? 'user' : draft.source} l />
            </div>
            <NumField label="Amount" unit={unit} big value={amount} onChange={setAmount} placeholder="0" />
            <div className="glass inner row between" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="muted">{mode === 'bought' || estimated ? '≈ ' : ''}This item</span>
              <span className="num b600">{mode === 'bought' || estimated ? '≈ ' : ''}{fmtInt(live.kcal)} kcal · P {fmtMacro(live.protein)} · C {fmtMacro(live.carbs)} · F {fmtMacro(live.fat)}</span>
            </div>
            {mode === 'cooked' && (
              <>
                <Cap>State</Cap>
                <div className="row g8">
                  <Chip on={!state} onClick={() => setState(undefined)}>None</Chip>
                  <Chip on={state === 'raw'} onClick={() => setState('raw')}>Raw</Chip>
                  <Chip on={state === 'cooked'} onClick={() => setState('cooked')}>Cooked</Chip>
                </div>
                <ToggleRow label="Estimated amount" sub="Counts against the exact % for this meal" checked={estimated} onChange={setEstimated} />
              </>
            )}
            {mode === 'bought' && <div className="t-13 muted">Bought meals are always estimated (≈).</div>}
            <ToggleRow label="Seasoning & oil" checked={isSeasoning} onChange={setIsSeasoning} />
            <TextField label="Name" value={name} onChange={setName} />
            <TextField label="Brand" value={brand} onChange={setBrand} />
            <TextField label="Note" value={note} onChange={setNote} />
            <button type="button" className="link" onClick={() => setShowN(!showN)}>{showN ? 'Hide' : 'Override'} nutrition per 100 {unit}</button>
            {showN && (
              <div className="grid2">
                {([['kcal', 'Calories'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fiber'], ['sugar', 'Sugar']] as const).map(([k, l]) => (
                  <NumField key={k} label={l} unit={k === 'kcal' ? 'kcal' : 'g'} value={n[k] != null ? Math.round((n[k] as number) * 100) / 100 : undefined}
                    onChange={(v) => { setN({ ...n, [k]: v }); setOverridden(true); }} />
                ))}
              </div>
            )}
            {overridden && <div className="t-12 muted">Any override marks this item as your own value (YOU). The library entry is unchanged.</div>}
            <Sep />
            {initial ? (
              <Btn className="danger" onClick={() => { onRemove?.(); onClose(); }}>Remove from meal</Btn>
            ) : (
              <button type="button" className="link" onClick={() => setStep('search')}>Choose a different food</button>
            )}
            <Btn block tint={C.orange} tintA={0.4} disabled={!amount} onClick={() => void save()}>{initial ? 'Save item' : 'Add to meal'}</Btn>
          </>
        )}
      </Sheet>
      {scanning && <Suspense fallback={null}><BarcodeScanner onCode={(c) => void onCode(c)} onClose={() => setScanning(false)} /></Suspense>}
    </>
  );
}
