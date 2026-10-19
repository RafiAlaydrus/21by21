import { useEffect, useState } from 'react';
import { norm } from '../logic/search';
import { db } from './schema';
import { newRec } from './ops';
import type { Food, FoodSource, Nutrients } from './types';

export interface RefFood { id: string; name: string; aliases: string[]; basis: 'g' | 'ml'; per100: Nutrients; state?: 'raw' | 'cooked'; source: FoodSource }

let cache: Promise<RefFood[]> | null = null;
/** Lazy-fetched, service-worker cached bundled database (read-only). */
export function loadRefFoods(): Promise<RefFood[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}fooddb/reference.json`)
    .then((r) => { if (!r.ok) throw new Error('fooddb'); return r.json(); })
    .then((j: { items: RefFood[] }) => j.items)
    .catch((e) => { cache = null; throw e; });
  return cache;
}

export function useRefFoods(enabled = true): { items: RefFood[]; error: boolean } {
  const [items, setItems] = useState<RefFood[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadRefFoods().then((x) => alive && setItems(x)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [enabled]);
  return { items, error };
}

/** rank: name starts with → a word starts with → name contains → alias contains */
export function searchRef(items: RefFood[], q: string, limit = 30): RefFood[] {
  const n = norm(q.trim());
  if (!n) return [];
  const scored: [number, RefFood][] = [];
  for (const it of items) {
    const name = norm(it.name);
    let s = -1;
    if (name.startsWith(n)) s = 0;
    else if (name.split(/[\s,()]+/).some((w) => w.startsWith(n))) s = 1;
    else if (name.includes(n)) s = 2;
    else if (it.aliases.some((a) => norm(a).includes(n))) s = 3;
    if (s >= 0) scored.push([s, it]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, limit).map((x) => x[1]);
}

/** Picking a reference item copies it into the user's library (once) so the user can correct it later. */
export async function ensureFoodFromRef(ref: RefFood): Promise<Food> {
  const existing = (await db.foods.toArray()).find((f) => f.refId === ref.id);
  if (existing) return existing;
  const f = newRec({ name: ref.name, basis: ref.basis, per100: ref.per100, defaultState: ref.state, source: ref.source, refId: ref.id, useCount: 0, lastUsedAt: 0 }) as Food;
  await db.foods.put(f);
  return f;
}
