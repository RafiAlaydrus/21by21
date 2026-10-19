import { describe, expect, it } from 'vitest';
import { dayExactPct, dayNutrition, exactPct, itemN, macroSplit, mealN, portionFactor } from './nutrition';
import { item, meal, per100 } from './testutil';
import type { Drink, DrinkType, Supplement, SupplementLog } from '../db/types';

const chicken = per100(120, 23, 0, 2.6); // per 100 g
const rice = per100(130, 2.7, 28, 0.3);

describe('item and meal totals', () => {
  it('item total = per100 × amount / 100', () => {
    const n = itemN(item(250, chicken));
    expect(n.kcal).toBeCloseTo(300);
    expect(n.protein).toBeCloseTo(57.5);
    expect(n.fat).toBeCloseTo(6.5);
  });
  it('meal total is the sum of its items', () => {
    const m = meal('2026-11-02', [item(250, chicken), item(180, rice)]);
    expect(mealN(m).kcal).toBeCloseTo(300 + 234);
    expect(mealN(m).carbs).toBeCloseTo(50.4);
  });
});

describe('cooked portions', () => {
  it('multiplies every item by eaten / whole dish', () => {
    const m = meal('2026-11-02', [item(250, chicken), item(180, rice)], { wholeDishG: 600, eatenG: 300 });
    expect(portionFactor(m)).toBe(0.5);
    expect(mealN(m).kcal).toBeCloseTo((300 + 234) / 2);
  });
  it('no factor without both numbers, never for bought meals', () => {
    expect(portionFactor({ mode: 'cooked', wholeDishG: 600 })).toBe(1);
    expect(portionFactor({ mode: 'cooked' })).toBe(1);
    expect(portionFactor({ mode: 'bought', wholeDishG: 600, eatenG: 300 })).toBe(1);
  });
});

describe('exact vs estimated %', () => {
  it('is kcal from non-estimated items over total kcal', () => {
    const items = [item(250, chicken, false), item(150, rice, true)]; // 300 exact, 195 estimated
    expect(exactPct(items)).toBeCloseTo((300 / 495) * 100);
  });
  it('bought meals (all estimated) are 0 % exact; cooked from labels 100 %', () => {
    expect(exactPct([item(200, chicken, true)])).toBe(0);
    expect(exactPct([item(200, chicken, false)])).toBe(100);
  });
  it('day level combines all meals', () => {
    const a = meal('2026-11-02', [item(100, per100(100), false)]);
    const b = meal('2026-11-02', [item(100, per100(100), true)], { mode: 'bought' });
    expect(dayExactPct([a, b])).toBe(50);
    expect(dayExactPct([])).toBeNull();
  });
});

describe('macro split', () => {
  it('uses 4/4/9 kcal per gram and sums to 100', () => {
    const s = macroSplit({ protein: 98, carbs: 104, fat: 38 });
    expect(s.p + s.c + s.f).toBe(100);
    expect(s.p).toBe(Math.round((98 * 4) / (98 * 4 + 104 * 4 + 38 * 9) * 100));
  });
  it('zero when nothing logged', () => expect(macroSplit({ protein: 0, carbs: 0, fat: 0 })).toEqual({ p: 0, c: 0, f: 0 }));
});

describe('day nutrition, water and supplements', () => {
  const base = { id: 'd', createdAt: 0, updatedAt: 0, dayKey: '2026-11-02', time: 0, tzOffsetMin: -480 };
  const coffee: DrinkType = { id: 'coffee', createdAt: 0, updatedAt: 0, name: 'Latte', per100ml: { kcal: 50, protein: 3, carbs: 5, fat: 2 } };
  const drinks: Drink[] = [
    { ...base, id: '1', kind: 'water', ml: 500 }, { ...base, id: '2', kind: 'water', ml: 300 },
    { ...base, id: '3', kind: 'other', drinkTypeId: 'coffee', ml: 200 },
  ];
  const creatine: Supplement = { id: 's1', createdAt: 0, updatedAt: 0, name: 'Whey', defaultAmount: 30, unit: 'g', daily: true, perServing: { kcal: 120, protein: 24, carbs: 3, fat: 1.5 } };
  const log = (amount: number, unit: string): SupplementLog => ({ ...base, id: `l${amount}${unit}`, supplementId: 's1', name: 'Whey', amount, unit });

  it('only plain water counts toward water; other drinks add nutrition but not water', () => {
    const r = dayNutrition([], drinks, [coffee], [], []);
    expect(r.waterMl).toBe(800);
    expect(r.otherMl).toBe(200);
    expect(r.total.kcal).toBeCloseTo(100);
  });
  it('supplement nutrition scales by amount / default amount when units match', () => {
    const r = dayNutrition([], [], [], [log(15, 'g')], [creatine]);
    expect(r.total.protein).toBeCloseTo(12);
    expect(r.notCounted).toHaveLength(0);
  });
  it('flags (and does not count) a supplement logged in a different unit', () => {
    const r = dayNutrition([], [], [], [log(1, 'scoop')], [creatine]);
    expect(r.total.kcal).toBe(0);
    expect(r.notCounted).toHaveLength(1);
  });
});
