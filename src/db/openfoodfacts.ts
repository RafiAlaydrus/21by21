import type { Food } from './types';

export type Lookup = { found: true; food: Partial<Food> } | { found: false; offline: boolean };

/** Open Food Facts lookup (PLAN §9.2). Values are per 100 g/ml as published; the user confirms and may edit everything. */
export async function lookupBarcode(code: string): Promise<Lookup> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_size`);
    if (!res.ok) return { found: false, offline: false };
    const j = await res.json();
    if (j.status === 0 || !j.product) return { found: false, offline: false };
    const n = j.product.nutriments ?? {};
    const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] != null ? n['energy_100g'] / 4.184 : 0);
    const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
    return {
      found: true,
      food: {
        name: j.product.product_name || '', brand: (j.product.brands || '').split(',')[0].trim() || undefined, basis: 'g',
        per100: {
          kcal: Math.round((num(kcal) ?? 0) * 10) / 10, protein: num(n['proteins_100g']) ?? 0, carbs: num(n['carbohydrates_100g']) ?? 0, fat: num(n['fat_100g']) ?? 0,
          fiber: num(n['fiber_100g']), sugar: num(n['sugars_100g']), sodiumMg: num(n['sodium_100g']) != null ? Math.round(n['sodium_100g'] * 1000) : undefined,
        },
        barcode: code, source: 'barcode',
      },
    };
  } catch {
    return { found: false, offline: true };
  }
}
