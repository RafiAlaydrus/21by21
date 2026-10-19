import { Suspense, lazy, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Btn, Card, Cap, Empty, IconBtn, NumField, Page, Segmented, TextField } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { SourceTag } from '../../components/SourceTag';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec } from '../../db/ops';
import { lookupBarcode } from '../../db/openfoodfacts';
import { norm } from '../../logic/search';
import { fmt1, fmtInt, fmtMacro } from '../../logic/format';
import { FoodForm } from './FoodForm';
import { SupplementForm } from '../log/SupplementForm';
import type { DrinkType, Food, Recipe, Supplement } from '../../db/types';
import { C } from '../../theme';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));
type Tab = 'foods' | 'recipes' | 'drinks' | 'supps';

export default function Library() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'foods';
  const setTab = (t: Tab) => setSp({ tab: t }, { replace: true });
  return (
    <Page title="Library" glows={[{ color: C.cyan, top: -40, right: -100, opacity: 0.18 }]}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'foods', label: 'Foods' }, { value: 'recipes', label: 'Recipes' }, { value: 'drinks', label: 'Drinks' }, { value: 'supps', label: 'Supps' }]} />
      {tab === 'foods' && <Foods />}
      {tab === 'recipes' && <Recipes />}
      {tab === 'drinks' && <Drinks />}
      {tab === 'supps' && <Supps />}
    </Page>
  );
}

function Foods() {
  const { foods } = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Food | 'new' | { food: Partial<Food>; note: string; source: 'barcode' | 'label' } | null>(null);
  const [scan, setScan] = useState(false);
  const list = useMemo(() => {
    const t = norm(q.trim());
    return [...foods].filter((f) => !t || norm(f.name).includes(t) || norm(f.brand ?? '').includes(t)).sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, q]);

  const onCode = async (code: string) => {
    setScan(false);
    const local = foods.find((f) => f.barcode === code);
    if (local) { setEdit(local); return; }
    const r = await lookupBarcode(code);
    setEdit(r.found ? { food: r.food, source: 'barcode', note: 'From Open Food Facts. Check every number against the label.' } : { food: { barcode: code }, source: 'label', note: r.offline ? 'Offline — enter the values from the label.' : 'Not found — enter from label.' });
  };
  const del = async (f: Food) => { await db.foods.delete(f.id); setEdit(null); toast('Food deleted', { undo: () => void db.foods.put(f) }); };
  const isFood = (e: typeof edit): e is Food => !!e && e !== 'new' && 'id' in e;

  return (
    <>
      <div className="row g8">
        <TextField className="grow" label="Search" value={q} onChange={setQ} />
        <IconBtn icon="barcode" label="Scan barcode" onClick={() => setScan(true)} />
        <IconBtn icon="plus" label="Add food" onClick={() => setEdit('new')} />
      </div>
      {foods.length === 0 && <Empty title="Your library is empty" sub="Foods you pick from the database, scan or create appear here. Correct any number and every future meal uses it." />}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {list.map((f) => (
          <button key={f.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => setEdit(f)}>
            <span className="stack g2 grow"><span className="b600 clip">{f.name}</span><span className="num t-12 muted clip">{f.brand ? `${f.brand} · ` : ''}{fmtInt(f.per100.kcal)} kcal · P {fmtMacro(f.per100.protein)} · C {fmtMacro(f.per100.carbs)} · F {fmtMacro(f.per100.fat)} /100 {f.basis}</span></span>
            <SourceTag source={f.source} />
          </button>
        ))}
      </Card>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={isFood(edit) ? 'Edit food' : 'New food'} tall>
        {edit && (isFood(edit)
          ? <FoodForm key={edit.id} initial={edit} onSaved={() => setEdit(null)} onDelete={() => void del(edit)} />
          : edit === 'new' ? <FoodForm onSaved={() => setEdit(null)} />
            : <FoodForm initial={edit.food} source={edit.source} note={edit.note} onSaved={() => setEdit(null)} />)}
      </Sheet>
      {scan && <Suspense fallback={null}><BarcodeScanner onCode={(c) => void onCode(c)} onClose={() => setScan(false)} /></Suspense>}
    </>
  );
}

function Recipes() {
  const { recipes } = useData();
  const toast = useToast();
  const [sel, setSel] = useState<Recipe | null>(null);
  const [name, setName] = useState('');
  return (
    <>
      {recipes.length === 0 && <Empty title="No saved recipes or usuals" sub="Turn on “Save as recipe” (cooked) or “Save as usual” (bought) when logging a meal." />}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {recipes.map((r) => (
          <button key={r.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => { setSel(r); setName(r.name); }}>
            <span className="stack g2"><span className="b600">{r.name}</span><span className="t-12 muted">{r.mode} · {r.items.length} items</span></span><span className="muted">›</span>
          </button>
        ))}
      </Card>
      <Sheet open={!!sel} onClose={() => setSel(null)} title="Recipe" action={{ label: 'Save', disabled: !name.trim(), onClick: async () => { if (sel) await saveRec(db.recipes, { ...sel, name: name.trim() }); setSel(null); } }}>
        <TextField label="Name" value={name} onChange={setName} />
        {sel?.items.map((i) => <div key={i.id} className="row between t-15"><span>{i.name}</span><span className="num muted">{fmt1(i.amount)} {i.basis}</span></div>)}
        <Btn className="danger" onClick={async () => { if (!sel) return; const r = sel; await db.recipes.delete(r.id); setSel(null); toast('Recipe deleted', { undo: () => void db.recipes.put(r) }); }}>Delete recipe</Btn>
      </Sheet>
    </>
  );
}

function Drinks() {
  const { drinkTypes } = useData();
  const toast = useToast();
  const [edit, setEdit] = useState<DrinkType | 'new' | null>(null);
  const [name, setName] = useState('');
  const [n, setN] = useState<{ kcal?: number; protein?: number; carbs?: number; fat?: number }>({});
  const open = (d: DrinkType | 'new') => { setEdit(d); setName(d === 'new' ? '' : d.name); setN(d === 'new' ? {} : d.per100ml ?? {}); };
  const save = async () => {
    const has = Object.values(n).some((v) => v != null);
    const per100ml = has ? { kcal: n.kcal ?? 0, protein: n.protein ?? 0, carbs: n.carbs ?? 0, fat: n.fat ?? 0 } : undefined;
    if (edit === 'new') await db.drinkTypes.put(newRec({ name: name.trim(), per100ml }) as DrinkType);
    else if (edit) await saveRec(db.drinkTypes, { ...edit, name: name.trim(), per100ml });
    setEdit(null);
  };
  return (
    <>
      <Btn onClick={() => open('new')}>+ New drink type</Btn>
      {drinkTypes.length === 0 && <Empty title="No drink types yet" sub="Coffee, tea, whey… Drinks never count toward water." />}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {drinkTypes.map((d) => (
          <button key={d.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => open(d)}>
            <span className="stack g2"><span className="b600">{d.name}</span><span className="num t-12 muted">{d.per100ml ? `${fmtInt(d.per100ml.kcal)} kcal /100 ml` : 'No nutrition'}</span></span><span className="muted">›</span>
          </button>
        ))}
      </Card>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Drink type" action={{ label: 'Save', disabled: !name.trim(), onClick: () => void save() }}>
        <TextField label="Name" value={name} onChange={setName} />
        <Cap>Per 100 ml (optional)</Cap>
        <div className="grid2">
          <NumField label="kcal" value={n.kcal} onChange={(v) => setN({ ...n, kcal: v })} />
          <NumField label="Protein g" value={n.protein} onChange={(v) => setN({ ...n, protein: v })} />
          <NumField label="Carbs g" value={n.carbs} onChange={(v) => setN({ ...n, carbs: v })} />
          <NumField label="Fat g" value={n.fat} onChange={(v) => setN({ ...n, fat: v })} />
        </div>
        {edit && edit !== 'new' && <Btn className="danger" onClick={async () => { const t = edit; await db.drinkTypes.delete(t.id); setEdit(null); toast('Drink type deleted', { undo: () => void db.drinkTypes.put(t) }); }}>Delete drink type</Btn>}
      </Sheet>
    </>
  );
}

function Supps() {
  const { supplements } = useData();
  const toast = useToast();
  const [edit, setEdit] = useState<Supplement | 'new' | null>(null);
  return (
    <>
      <Btn onClick={() => setEdit('new')}>+ New supplement</Btn>
      {supplements.length === 0 && <Empty title="No supplements yet" />}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {supplements.map((s) => (
          <button key={s.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => setEdit(s)}>
            <span className="stack g2"><span className="b600">{s.name}</span><span className="t-12 muted">{fmt1(s.defaultAmount)} {s.unit}{s.timingTag ? ` · ${s.timingTag}` : ''}{s.daily ? ' · daily' : ''}</span></span><span className="muted">›</span>
          </button>
        ))}
      </Card>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New supplement' : 'Supplement'} tall>
        {edit && <SupplementForm key={edit === 'new' ? 'n' : edit.id} initial={edit === 'new' ? undefined : edit} onSaved={() => setEdit(null)}
          onDelete={edit === 'new' ? undefined : async () => { const sp = edit; await db.supplements.delete(sp.id); setEdit(null); toast('Supplement deleted', { undo: () => void db.supplements.put(sp) }); }} />}
      </Sheet>
    </>
  );
}
