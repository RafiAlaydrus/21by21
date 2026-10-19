export const norm = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** case- and diacritics-insensitive substring match over any number of fields */
export function matches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = norm(query.trim());
  if (!q) return false;
  return fields.some((f) => f != null && norm(f).includes(q));
}

export type SearchKind = 'meal' | 'food' | 'recipe' | 'exercise' | 'workout' | 'craving' | 'note' | 'tag' | 'reminder' | 'checkin';
export interface SearchHit { kind: SearchKind; id: string; title: string; sub?: string; dayKey?: string }

import type { AppData } from '../hooks/useData';
export function searchAll(q: string, d: Pick<AppData, 'meals' | 'foods' | 'recipes' | 'exercises' | 'workouts' | 'cravings' | 'dayNotes' | 'dayTags' | 'reminders' | 'checkins'>): SearchHit[] {
  if (!q.trim()) return [];
  const hits: SearchHit[] = [];
  for (const m of d.meals) if (matches(q, m.place, m.note, m.label, ...m.items.map((i) => i.name))) hits.push({ kind: 'meal', id: m.id, title: `${m.label} · ${m.items.map((i) => i.name).slice(0, 3).join(', ')}`, sub: m.place, dayKey: m.dayKey });
  for (const f of d.foods) if (matches(q, f.name, f.brand, f.note)) hits.push({ kind: 'food', id: f.id, title: f.name, sub: f.brand });
  for (const r of d.recipes) if (matches(q, r.name, ...r.items.map((i) => i.name))) hits.push({ kind: 'recipe', id: r.id, title: r.name });
  for (const e of d.exercises) if (matches(q, e.name, ...e.muscleGroups)) hits.push({ kind: 'exercise', id: e.id, title: e.name, sub: e.muscleGroups.join(', ') });
  for (const w of d.workouts) if (matches(q, w.title, w.note)) hits.push({ kind: 'workout', id: w.id, title: w.title || 'Workout', dayKey: w.dayKey });
  for (const c of d.cravings) if (matches(q, c.what, c.note)) hits.push({ kind: 'craving', id: c.id, title: c.what, sub: c.outcome, dayKey: c.dayKey });
  for (const n of d.dayNotes) if (matches(q, n.text)) hits.push({ kind: 'note', id: n.id, title: n.text.slice(0, 80), dayKey: n.dayKey });
  for (const t of d.dayTags) { const hit = t.tags.find((x) => matches(q, x)); if (hit) hits.push({ kind: 'tag', id: t.id, title: hit, dayKey: t.dayKey }); }
  for (const r of d.reminders) if (matches(q, r.text)) hits.push({ kind: 'reminder', id: r.id, title: r.text });
  for (const c of d.checkins) if (matches(q, c.note)) hits.push({ kind: 'checkin', id: c.id, title: (c.note ?? '').slice(0, 80), dayKey: c.dayKey });
  return hits;
}
