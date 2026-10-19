import type { Table } from 'dexie';
import { db } from './schema';
import { defaultSettings, mergeSettings } from './defaults';
import { dayKey } from '../logic/dates';
import type { ActiveSleep, Rec, Settings } from './types';

export const uid = (): string => crypto.randomUUID();
export const tzNow = (): number => new Date().getTimezoneOffset();
export const todayKey = (): string => dayKey(Date.now());

/** Build a new record with id + timestamps. dayKey (if any) is whatever the caller froze at log time. */
export function newRec<T extends object>(fields: T, skipLate = false): T & Rec {
  const now = Date.now();
  const rec = { ...fields, id: uid(), createdAt: now, updatedAt: now } as T & Rec;
  return skipLate ? rec : markLate(rec);
}

/** Records created/edited after their day ended get a tiny "edited later" marker. */
function markLate<T extends Rec>(rec: T): T {
  const k = (rec as unknown as { dayKey?: string }).dayKey;
  if (k && k < todayKey()) rec.editedLate = true;
  return rec;
}

export async function saveRec<T extends Rec>(table: Table<T, string>, rec: T): Promise<T> {
  // a night sleep is attributed to the previous day by design, so it is never "late"
  const next = { ...rec, updatedAt: Date.now() };
  if (table.name !== 'sleeps') markLate(next);
  await table.put(next);
  return next;
}

/** One-per-day tables (check-in, steps, soreness, tags, notes, custom logs) use a deterministic id. */
export async function upsertDaily<T extends Rec & { dayKey: string }>(table: Table<T, string>, id: string, fields: Omit<T, keyof Rec>): Promise<T> {
  const existing = await table.get(id);
  const now = Date.now();
  const rec = markLate({ ...(existing ?? { createdAt: now }), ...fields, id, updatedAt: now } as unknown as T);
  await table.put(rec);
  return rec;
}

/* ---------- settings ---------- */
export async function ensureSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  if (s) return mergeSettings(s);
  const d = defaultSettings();
  await db.settings.put(d);
  return d;
}
export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ ...s, updatedAt: Date.now() });
}
export async function updateSettings(fn: (s: Settings) => void): Promise<void> {
  const cur = mergeSettings(await db.settings.get('settings'));
  const draft = structuredClone(cur);
  fn(draft);
  await saveSettings(draft);
}

/* ---------- meta ---------- */
export const getMeta = async <T,>(key: string): Promise<T | undefined> => (await db.meta.get(key))?.value as T | undefined;
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
export const delMeta = (key: string) => db.meta.delete(key);

export const getActiveSleep = () => getMeta<ActiveSleep>('activeSleep');

/** soft-delete helper used with Undo toasts: returns a function that restores the record */
export async function removeWithUndo<T extends { id: string }>(table: Table<T, string>, id: string): Promise<() => Promise<void>> {
  const rec = await table.get(id);
  await table.delete(id);
  return async () => { if (rec) await table.put(rec); };
}
