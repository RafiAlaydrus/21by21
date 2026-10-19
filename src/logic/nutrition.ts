import type { Drink, DrinkType, Meal, MealItem, Nutrients, Supplement, SupplementLog } from '../db/types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function scaleN(n: Nutrients, k: number): Nutrients {
  const out: Nutrients = { kcal: n.kcal * k, protein: n.protein * k, carbs: n.carbs * k, fat: n.fat * k };
  if (n.fiber != null) out.fiber = n.fiber * k;
  if (n.sugar != null) out.sugar = n.sugar * k;
  if (n.sodiumMg != null) out.sodiumMg = n.sodiumMg * k;
  return out;
}
export function addN(a: Nutrients, b: Nutrients): Nutrients {
  const out: Nutrients = { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
  const opt = (k: 'fiber' | 'sugar' | 'sodiumMg') => { if (a[k] != null || b[k] != null) out[k] = (a[k] ?? 0) + (b[k] ?? 0); };
  opt('fiber'); opt('sugar'); opt('sodiumMg');
  return out;
}
export const sumN = (list: Nutrients[]): Nutrients => list.reduce(addN, ZERO);

/** item totals = per100 × amount / 100 */
export const itemN = (it: Pick<MealItem, 'per100' | 'amount'>): Nutrients => scaleN(it.per100, it.amount / 100);

/** Cooked meal portion: eatenG / wholeDishG applied to every item. Anything else = 1. */
export function portionFactor(m: { mode?: 'bought' | 'cooked'; wholeDishG?: number; eatenG?: number }): number {
  if (m.mode === 'bought') return 1;
  if (m.wholeDishG && m.wholeDishG > 0 && m.eatenG != null && m.eatenG >= 0) return m.eatenG / m.wholeDishG;
  return 1;
}

export const mealN = (m: Pick<Meal, 'items' | 'mode' | 'wholeDishG' | 'eatenG'>): Nutrients =>
  scaleN(sumN(m.items.map(itemN)), portionFactor(m));

/** % of kcal that comes from items with `estimated === false`. */
export function exactPct(items: Pick<MealItem, 'per100' | 'amount' | 'estimated'>[]): number {
  let total = 0, exact = 0;
  for (const it of items) { const k = itemN(it).kcal; total += k; if (!it.estimated) exact += k; }
  if (total === 0) return items.some((i) => i.estimated) ? 0 : 100;
  return (exact / total) * 100;
}

/** share of calories from protein/carbs/fat (4/4/9 kcal per g), rounded to sum to 100 */
export function macroSplit(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): { p: number; c: number; f: number } {
  const p = n.protein * 4, c = n.carbs * 4, f = n.fat * 9, t = p + c + f;
  if (t <= 0) return { p: 0, c: 0, f: 0 };
  const P = Math.round((p / t) * 100), C = Math.round((c / t) * 100);
  return { p: P, c: C, f: Math.max(0, 100 - P - C) };
}

export function drinkN(d: Pick<Drink, 'kind' | 'ml' | 'drinkTypeId'>, types: DrinkType[]): Nutrients {
  if (d.kind === 'water') return ZERO;
  const t = types.find((x) => x.id === d.drinkTypeId);
  return t?.per100ml ? scaleN({ ...ZERO, ...t.per100ml }, d.ml / 100) : ZERO;
}

/** Supplement nutrition counts only when the logged unit matches the library unit; otherwise it is flagged. */
export function suppN(log: Pick<SupplementLog, 'amount' | 'unit' | 'supplementId'>, supps: Supplement[]): { n: Nutrients; notCounted: boolean } {
  const s = supps.find((x) => x.id === log.supplementId);
  if (!s?.perServing) return { n: ZERO, notCounted: false };
  if (log.unit !== s.unit || !s.defaultAmount) return { n: ZERO, notCounted: true };
  return { n: scaleN({ ...ZERO, ...s.perServing }, log.amount / s.defaultAmount), notCounted: false };
}

export interface DayNutrition { total: Nutrients; meals: Nutrients; drinks: Nutrients; supps: Nutrients; notCounted: SupplementLog[]; waterMl: number; otherMl: number }

export function dayNutrition(meals: Meal[], drinks: Drink[], types: DrinkType[], suppLogs: SupplementLog[], supps: Supplement[]): DayNutrition {
  const m = sumN(meals.map(mealN));
  const d = sumN(drinks.map((x) => drinkN(x, types)));
  const notCounted: SupplementLog[] = [];
  const s = sumN(suppLogs.map((l) => { const r = suppN(l, supps); if (r.notCounted) notCounted.push(l); return r.n; }));
  return {
    total: sumN([m, d, s]), meals: m, drinks: d, supps: s, notCounted,
    // ONLY plain water counts toward the water target
    waterMl: drinks.filter((x) => x.kind === 'water').reduce((a, x) => a + x.ml, 0),
    otherMl: drinks.filter((x) => x.kind === 'other').reduce((a, x) => a + x.ml, 0),
  };
}

/** day-level exact %: kcal from non-estimated meal items over all meal-item kcal (portion-adjusted). null when no food kcal. */
export function dayExactPct(meals: Meal[]): number | null {
  let total = 0, exact = 0;
  for (const m of meals) {
    const k = portionFactor(m);
    for (const it of m.items) { const kc = itemN(it).kcal * k; total += kc; if (!it.estimated) exact += kc; }
  }
  return total > 0 ? (exact / total) * 100 : null;
}
