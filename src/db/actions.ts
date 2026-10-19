import { db } from './schema';
import { newRec, tzNow } from './ops';
import { defaultLogTime, logDay } from '../hooks/useLogTime';
import type { Drink, Supplement, SupplementLog } from './types';

export interface AtOpts { dayKey?: string; time?: number }

export async function addDrink(o: { kind: 'water' | 'other'; ml: number; drinkTypeId?: string } & AtOpts): Promise<Drink> {
  const rec = newRec({
    dayKey: logDay(o.dayKey), time: o.time ?? defaultLogTime(o.dayKey), tzOffsetMin: tzNow(),
    kind: o.kind, ml: o.ml, drinkTypeId: o.drinkTypeId,
  }) as Drink;
  await db.drinks.put(rec);
  return rec;
}

export async function logSupplement(s: Supplement, o: AtOpts & { amount?: number; unit?: string; timingTag?: string } = {}): Promise<SupplementLog> {
  const rec = newRec({
    dayKey: logDay(o.dayKey), time: o.time ?? defaultLogTime(o.dayKey), tzOffsetMin: tzNow(),
    supplementId: s.id, name: s.name, amount: o.amount ?? s.defaultAmount, unit: o.unit ?? s.unit, timingTag: o.timingTag ?? s.timingTag,
  }) as SupplementLog;
  await db.supplementLogs.put(rec);
  return rec;
}
