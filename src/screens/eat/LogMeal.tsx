import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Cap, Chip, Glows, NumField, Segmented, Switch, TextField, TimePill } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Sheet } from '../../components/Sheet';
import { SourceTag, StateTag } from '../../components/SourceTag';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec, tzNow, uid } from '../../db/ops';
import { savePhoto, useBlobUrl, useFileUrl } from '../../db/photos';
import { epochFor, fmtTime } from '../../logic/dates';
import { exactPct, itemN, mealN, portionFactor } from '../../logic/nutrition';
import { fmtDayWd, fmtInt, fmtMacro } from '../../logic/format';
import { defaultLogTime } from '../../hooks/useLogTime';
import { ItemSheet } from './ItemSheet';
import type { Meal, MealItem, Money, Recipe } from '../../db/types';
import { C } from '../../theme';

const cloneItems = (items: MealItem[]) => items.map((i) => ({ ...i, id: uid() }));

export default function LogMeal() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { meals, recipes, settings, today } = useData();
  const editId = sp.get('edit');
  const existing = editId ? meals.find((m) => m.id === editId) : undefined;
  const day = existing?.dayKey ?? sp.get('day') ?? today;
  const tz = existing?.tzOffsetMin ?? tzNow();

  const firstFree = settings.mealLabels.find((l) => !meals.some((m) => m.dayKey === day && m.label === l)) ?? settings.mealLabels[0] ?? 'Meal';
  const [mode, setMode] = useState<'bought' | 'cooked'>(existing?.mode ?? 'cooked');
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [photoId, setPhotoId] = useState<string | undefined>(existing?.photoId);
  const [label, setLabel] = useState(existing?.label ?? sp.get('label') ?? firstFree);
  const [customLabel, setCustomLabel] = useState(false);
  const [timeStr, setTimeStr] = useState(fmtTime(existing?.time ?? defaultLogTime(day), tz));
  const [items, setItems] = useState<MealItem[]>(existing?.items ?? []);
  const [place, setPlace] = useState(existing?.place ?? '');
  const [price, setPrice] = useState<Money>(existing?.price ?? { amount: 0, currency: settings.currencies[0] ?? '' });
  const [cost, setCost] = useState<Money>(existing?.cost ?? { amount: 0, currency: settings.currencies[0] ?? '' });
  const [method, setMethod] = useState(existing?.method);
  const [cookTime, setCookTime] = useState<number | undefined>(existing?.cookTimeMin);
  const [tool, setTool] = useState(existing?.tool ?? '');
  const [whole, setWhole] = useState<number | undefined>(existing?.wholeDishG);
  const [eaten, setEaten] = useState<number | undefined>(existing?.eatenG);
  const [clean, setClean] = useState(existing?.clean ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [recipeId, setRecipeId] = useState(existing?.recipeId);
  const [saveRecipe, setSaveRecipe] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<{ initial?: MealItem; seasoning: boolean; n: number; scan?: boolean } | null>(null);
  const [recipePicker, setRecipePicker] = useState(false);
  const [customMethod, setCustomMethod] = useState(false);
  const cam = useRef<HTMLInputElement>(null);

  const fileUrl = useFileUrl(photoFile);
  const savedUrl = useBlobUrl(photoFile ? undefined : photoId, 'full');
  const photoUrl = fileUrl ?? savedUrl;
  const hasPhoto = !!photoFile || !!photoId;

  const bought = mode === 'bought';
  const factor = bought ? 1 : portionFactor({ mode, wholeDishG: whole, eatenG: eaten });
  const totals = useMemo(() => mealN({ items, mode, wholeDishG: whole, eatenG: eaten }), [items, mode, whole, eaten]);
  const exact = Math.round(exactPct(items));
  const plate = items.filter((i) => !i.isSeasoning);
  const seasonings = items.filter((i) => i.isSeasoning);
  const itemsTotalG = Math.round(items.reduce((a, i) => a + i.amount, 0));
  const approx = bought || exact < 100 ? '≈ ' : '';

  const switchMode = (m: 'bought' | 'cooked') => { setMode(m); setItems((l) => l.map((i) => ({ ...i, estimated: m === 'bought' }))); };
  const upsertItem = (it: MealItem) => setItems((l) => (l.some((x) => x.id === it.id) ? l.map((x) => (x.id === it.id ? it : x)) : [...l, it]));
  const applyRecipe = (r: Recipe) => {
    setItems(cloneItems(r.items).map((i) => ({ ...i, estimated: bought })));
    if (r.place != null) setPlace(r.place);
    if (r.price) setPrice(r.price);
    if (r.cost) setCost(r.cost);
    setMethod(r.method); setTool(r.tool ?? ''); setCookTime(r.cookTimeMin); setWhole(r.wholeDishG); setRecipeId(r.id);
    setRecipePicker(false);
  };

  const save = async () => {
    if (!hasPhoto || saving) return;
    setSaving(true);
    try {
      let pid = photoId;
      if (photoFile) {
        pid = await savePhoto(photoFile, 'meal');
        if (photoId && photoId !== pid) await db.blobs.delete(photoId);
      }
      let rid = recipeId;
      if (saveRecipe) {
        const r = newRec({
          name: recipeName.trim() || label, mode, items: cloneItems(items), method: bought ? undefined : method, tool: bought ? undefined : tool || undefined,
          cookTimeMin: bought ? undefined : cookTime, place: place.trim() || undefined, wholeDishG: bought ? undefined : whole,
          price: bought && price.amount > 0 ? price : undefined, cost: !bought && cost.amount > 0 ? cost : undefined,
        }) as Recipe;
        await db.recipes.put(r);
        rid = r.id;
      }
      const fields = {
        dayKey: day, time: epochFor(day, timeStr, tz), tzOffsetMin: tz, label, mode, photoId: pid!, items, clean, note: note.trim() || undefined, recipeId: rid,
        place: bought ? place.trim() || undefined : undefined, price: bought && price.amount > 0 ? price : undefined,
        method: bought ? undefined : method, cookTimeMin: bought ? undefined : cookTime, tool: bought ? undefined : tool.trim() || undefined,
        wholeDishG: bought ? undefined : whole, eatenG: bought ? undefined : eaten, cost: !bought && cost.amount > 0 ? cost : undefined,
      };
      if (existing) {
        await saveRec(db.meals, { ...existing, ...fields });
        toast('Meal updated');
      } else {
        const rec = newRec(fields) as Meal;
        await db.meals.put(rec);
        const ids = [...new Set(items.map((i) => i.foodId).filter((x): x is string => !!x))];
        if (ids.length) await db.foods.where('id').anyOf(ids).modify((f) => { f.useCount += 1; f.lastUsedAt = Date.now(); });
        toast('Meal saved', { undo: () => void db.meals.delete(rec.id) });
      }
      nav(-1);
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!existing) return;
    await db.meals.delete(existing.id);
    nav(-1);
    toast('Meal deleted', { undo: () => void db.meals.put(existing) });
  };

  const labels = settings.mealLabels.includes(label) ? settings.mealLabels : [...settings.mealLabels, label];
  const usuals = recipes.filter((r) => r.mode === 'bought');
  const cookedRecipes = recipes.filter((r) => r.mode === 'cooked');

  const money = (v: Money, set: (m: Money) => void, lbl: string) => (
    <div className="stack g8">
      <NumField label={lbl} value={v.amount || undefined} onChange={(a) => set({ ...v, amount: a ?? 0 })} />
      {settings.currencies.length > 1 && (
        <div className="row g6 wrap">{settings.currencies.map((c) => <Chip key={c} sm on={v.currency === c} onClick={() => set({ ...v, currency: c })}>{c}</Chip>)}</div>
      )}
    </div>
  );

  const photoSection = hasPhoto ? (
    <section aria-label="Meal photo" style={{ position: 'relative' }}>
      <div className="photo-ph" style={{ aspectRatio: '4 / 3', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)' }}>{photoUrl && <img src={photoUrl} alt="Meal" />}</div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f); e.target.value = ''; }} />
      <Btn sm style={{ position: 'absolute', right: 12, bottom: 12 }} onClick={() => cam.current?.click()}>Retake</Btn>
    </section>
  ) : (
    <section aria-label="Meal photo" className="glass card">
      <div style={{ aspectRatio: '3 / 2', borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.28)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="camera" size={36} sw={1.8} color={C.orange} />
        <div className="t-17 b600">Add meal photo</div>
        <div className="t-13 b600" style={{ color: C.orange }}>REQUIRED</div>
      </div>
      <PhotoPicker onPick={setPhotoFile} />
    </section>
  );

  const mealCard = (
    <section aria-label="Meal and time" className="glass card">
      <div className="row between"><Cap>Meal</Cap><TimePill value={timeStr} onChange={setTimeStr} /></div>
      <div className="row wrap g8">
        {labels.map((l) => <Chip key={l} on={label === l} onClick={() => { setLabel(l); setCustomLabel(false); }}>{l}</Chip>)}
        <Chip className="light" onClick={() => setCustomLabel(!customLabel)}>+ Custom</Chip>
      </div>
      {customLabel && <TextField label="Custom meal name" value={label} onChange={setLabel} autoFocus />}
      {!bought && (
        <button type="button" className="glass-btn row between" style={{ borderRadius: 16, padding: '10px 12px', minHeight: 44, textAlign: 'left' }} onClick={() => setRecipePicker(true)}>
          <span>Use saved recipe</span><span className="muted">{recipes.find((r) => r.id === recipeId)?.name ?? 'Choose'} ›</span>
        </button>
      )}
    </section>
  );

  return (
    <div className="screen no-tabs fade-in">
      <Glows list={[{ color: C.orange, top: -40, left: -100, size: 320, opacity: 0.2 }, { color: bought ? C.red : C.green, top: 900, right: -120, opacity: bought ? 0.12 : 0.14 }]} />
      <header className="hdr">
        <button type="button" className="glass-btn btn" onClick={() => nav(-1)}>Cancel</button>
        <h1 className="t-17 b600">{existing ? 'Edit meal' : 'Log meal'}</h1>
        <button type="button" className="glass-btn btn" disabled={!hasPhoto || saving} onClick={() => void save()} style={{ color: hasPhoto ? C.orange : undefined, fontWeight: 700 }}>Save</button>
      </header>
      {day !== today && <div className="t-13 muted ta-center">Logging for {fmtDayWd(day)}</div>}

      <Segmented solid value={mode} onChange={switchMode} options={[{ value: 'bought', label: 'Bought' }, { value: 'cooked', label: 'Cooked' }]} />
      {photoSection}

      {bought && usuals.length > 0 && (
        <section aria-label="Saved meals" className="stack g8">
          <Cap style={{ padding: '0 4px' }}>Saved · 1 tap</Cap>
          <div className="chips-scroll">{usuals.map((r) => <Chip key={r.id} sm on={recipeId === r.id} onClick={() => applyRecipe(r)}>{r.name}</Chip>)}</div>
        </section>
      )}

      {mealCard}

      {bought ? (
        <section aria-label="Where" className="glass card">
          <TextField label="Where" value={place} onChange={setPlace} placeholder="Place" />
          {settings.trackers.spending && money(price, setPrice, 'Price')}
        </section>
      ) : (
        <section aria-label="Cooking" className="glass card">
          <Cap>Cooking method</Cap>
          <div className="row wrap g8">
            {settings.cookingMethods.map((m) => <Chip key={m} sm on={method === m} color={C.orange} onClick={() => setMethod(method === m ? undefined : m)}>{m}</Chip>)}
            <Chip sm className="light" onClick={() => setCustomMethod(!customMethod)}>+</Chip>
          </div>
          {customMethod && <TextField label="Other method" value={method ?? ''} onChange={(v) => setMethod(v || undefined)} autoFocus />}
          <div className="grid2">
            <NumField label="Cook time" unit="min" mode="numeric" value={cookTime} onChange={setCookTime} />
            <TextField label="Tool" value={tool} onChange={setTool} />
          </div>
        </section>
      )}

      <section aria-label={bought ? "What's on the plate" : 'Ingredients'} className="glass card">
        <div className="row between">
          <h2 className="t-card">{bought ? 'On the plate' : 'Ingredients'}</h2>
          <div className="row g8">
            {!bought && <button type="button" className="glass-btn icon-btn sm" aria-label="Scan barcode" onClick={() => setSheet({ seasoning: false, n: Date.now(), scan: true })}><Icon name="barcode" size={18} /></button>}
            <Btn tight onClick={() => setSheet({ seasoning: false, n: Date.now() })}>{bought ? '+ Item' : '+ Add'}</Btn>
          </div>
        </div>

        {items.length === 0 && <div className="empty"><div className="b600">No items yet</div><div className="t-13 muted">Add what is on the plate. Everything is optional except the photo.</div></div>}

        {bought && plate.length > 0 && (
          <div className="glass-btn" style={{ borderRadius: 18, padding: '4px 12px' }}>
            {plate.map((i) => {
              const n = itemN(i);
              return (
                <button key={i.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => setSheet({ initial: i, seasoning: i.isSeasoning, n: Date.now() })}>
                  <span className="stack g2 grow">
                    <span className="t-17 b600 clip">{i.name}</span>
                    <span className="row g6"><span className="num t-12 light">≈ {fmtInt(n.kcal)} kcal{n.protein >= 0.5 ? ` · P ${fmtMacro(n.protein)}` : ''}{n.carbs >= 0.5 && n.protein < 0.5 ? ` · C ${fmtMacro(n.carbs)}` : ''}</span><SourceTag source={i.source} /></span>
                  </span>
                  <span className="num t-17 b700">≈ {fmtMacro(i.amount)} {i.basis}</span>
                </button>
              );
            })}
          </div>
        )}

        {!bought && plate.map((i) => {
          const n = itemN(i);
          return (
            <button key={i.id} type="button" className="glass-btn stack g6" style={{ borderRadius: 18, padding: 12, textAlign: 'left' }} onClick={() => setSheet({ initial: i, seasoning: false, n: Date.now() })}>
              <span className="row between baseline"><span className="t-17 b600">{i.name}</span><span className="num t-17 b700">{i.estimated ? '≈ ' : ''}{fmtMacro(i.amount)} {i.basis}</span></span>
              <span className="row wrap g6">{i.brand && <span className="t-13 muted">{i.brand}</span>}<StateTag state={i.state} /><SourceTag source={i.source} l /></span>
              <span className="num t-13 light">{fmtInt(n.kcal)} kcal · P {fmtMacro(n.protein)} · C {fmtMacro(n.carbs)} · F {fmtMacro(n.fat)}</span>
              {i.note && <span className="t-13 muted" style={{ fontStyle: 'italic' }}>{i.note}</span>}
            </button>
          );
        })}

        {(!bought || seasonings.length > 0) && (
          <>
            <div className="row between" style={{ marginTop: 6 }}>
              <Cap>Seasoning &amp; oil</Cap>
              <button type="button" className="glass-btn icon-btn sm" aria-label="Add seasoning or oil" onClick={() => setSheet({ seasoning: true, n: Date.now() })}><Icon name="plus" size={18} /></button>
            </div>
            {seasonings.length > 0 && (
              <div className="glass-btn" style={{ borderRadius: 18, padding: '4px 12px' }}>
                {seasonings.map((i) => {
                  const n = itemN(i);
                  return (
                    <button key={i.id} type="button" className="rowline" style={{ justifyContent: 'space-between', padding: '10px 0' }} onClick={() => setSheet({ initial: i, seasoning: true, n: Date.now() })}>
                      <span className="stack grow"><span className="t-15 b600">{i.name}</span><span className="t-12 muted clip">{[i.brand, `${bought || i.estimated ? '≈ ' : ''}${fmtInt(n.kcal)} kcal`, n.fat >= 0.5 ? `F ${fmtMacro(n.fat)}` : ''].filter(Boolean).join(' · ')}</span></span>
                      <span className="num t-15 b700">{fmtMacro(i.amount)} {i.basis}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {items.length > 0 && <div className="t-13 muted">Tap an item to change grams or override its numbers.</div>}
      </section>

      {!bought && (
        <section aria-label="Portion" className="glass card">
          <Cap>Portion</Cap>
          <div className="grid2">
            <NumField label="Whole dish" unit="g" value={whole} onChange={setWhole} placeholder={itemsTotalG ? String(itemsTotalG) : '0'} />
            <NumField label="I ate" unit="g" value={eaten} onChange={setEaten} placeholder={whole ? String(whole) : '0'} />
          </div>
          <div className="row between t-13 muted">
            <span>{whole && eaten != null ? `${Math.round(factor * 100)}% of the dish` : '100% of the dish'}</span>
            {itemsTotalG > 0 && whole !== itemsTotalG && <button type="button" className="link" style={{ fontSize: 13, minHeight: 0 }} onClick={() => setWhole(itemsTotalG)}>Use ingredients total ({itemsTotalG} g)</button>}
          </div>
        </section>
      )}

      <section aria-label="Meal totals" className="glass card">
        <div className="row between baseline">
          <Cap>This meal</Cap>
          {bought ? <span className="t-12 b700" style={{ color: C.orange }}>≈ ESTIMATED</span> : <span className="t-12 b700" style={{ color: exact === 100 ? C.green : C.orange }}>{exact}% EXACT</span>}
        </div>
        <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>{approx}{fmtInt(totals.kcal)} <span className="t-17 muted b600">kcal</span></div>
        <div className="grid3">
          {([['Protein', totals.protein, C.green], ['Carbs', totals.carbs, C.orange], ['Fat', totals.fat, C.yellow]] as const).map(([l, v, c]) => (
            <div key={l} className="glass-btn stack g2" style={{ borderRadius: 14, padding: 10 }}>
              <span className="t-11 b600" style={{ color: c, textTransform: 'uppercase' }}>{l}</span>
              <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{approx}{fmtMacro(v)} g</span>
            </div>
          ))}
        </div>
        <div className="toggle-row"><span>Clean meal</span><Switch checked={clean} onChange={setClean} label="Clean meal" /></div>
        <div className="toggle-row"><span>{bought ? 'Save as “usual”' : 'Save as recipe'}</span><Switch checked={saveRecipe} onChange={setSaveRecipe} label={bought ? 'Save as usual meal' : 'Save as recipe'} /></div>
        {saveRecipe && <TextField label="Name" value={recipeName} onChange={setRecipeName} placeholder={label} />}
        {!bought && settings.trackers.spending && money(cost, setCost, 'Ingredient cost')}
      </section>

      <section aria-label="Note" className="glass card">
        <label htmlFor="meal-note" className="cap">Note</label>
        <textarea id="meal-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ fontSize: 16 }} />
      </section>

      <Btn block tint={C.orange} tintA={0.32} disabled={!hasPhoto || saving} onClick={() => void save()}>{hasPhoto ? (existing ? 'Save changes' : 'Save meal') : 'Add photo to save'}</Btn>
      {existing && <Btn className="danger" onClick={() => void del()}>Delete meal</Btn>}

      <ItemSheet key={sheet?.n ?? 0} open={!!sheet} onClose={() => setSheet(null)} mode={mode} seasoning={sheet?.seasoning ?? false} initial={sheet?.initial} autoScan={sheet?.scan}
        onSave={upsertItem} onRemove={() => sheet?.initial && setItems((l) => l.filter((x) => x.id !== sheet.initial!.id))} />

      <Sheet open={recipePicker} onClose={() => setRecipePicker(false)} title="Saved recipes">
        {cookedRecipes.length === 0 && <div className="empty"><div className="b600">No saved recipes</div><div className="t-13 muted">Turn on “Save as recipe” when logging a cooked meal.</div></div>}
        {cookedRecipes.map((r) => (
          <button key={r.id} type="button" className="glass-btn row between" style={{ borderRadius: 16, padding: '12px 14px', minHeight: 52 }} onClick={() => applyRecipe(r)}>
            <span className="b600">{r.name}</span><span className="t-13 muted">{r.items.length} items</span>
          </button>
        ))}
      </Sheet>
    </div>
  );
}
