import { db, DATA_TABLES, SCHEMA_VERSION } from './schema';
import { mergeSettings } from './defaults';
import { updateSettings } from './ops';
import { dayKey } from '../logic/dates';
import type { BlobRec } from './types';

/** Backup = a zip: data.json (all tables + schema version) and photos/<id>.jpg + thumbs/<id>.jpg. jszip is lazy-loaded. */
export async function exportBackup(): Promise<{ blob: Blob; name: string }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const tables: Record<string, unknown[]> = { settings: await db.settings.toArray() };
  for (const t of DATA_TABLES) tables[t] = await db.table(t).toArray();
  const blobs = await db.blobs.toArray();
  zip.file('data.json', JSON.stringify({
    app: '21by21', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), tables,
    blobs: blobs.map(({ id, kind, takenAt, createdAt, updatedAt }) => ({ id, kind, takenAt, createdAt, updatedAt })),
  }));
  for (const b of blobs) { zip.file(`photos/${b.id}.jpg`, b.full); zip.file(`thumbs/${b.id}.jpg`, b.thumb); }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return { blob, name: `21by21-backup-${dayKey(Date.now())}-${p(d.getHours())}${p(d.getMinutes())}.zip` };
}

/** hand the zip to the iOS share sheet (Save to Files) or fall back to a download */
export async function saveFile(blob: Blob, name: string, type: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], name, { type });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
  } catch (e) { if ((e as DOMException).name === 'AbortError') return 'shared'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export const markBackedUp = () => updateSettings((s) => { s.lastBackupAt = Date.now(); });

export interface BackupInfo { exportedAt: number; schemaVersion: number; photos: number; meals: number; workouts: number }

/** read + validate without touching the database */
export async function inspectBackup(file: Blob): Promise<BackupInfo> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const raw = await zip.file('data.json')?.async('string');
  if (!raw) throw new Error('This is not a 21 by 21 backup (data.json missing).');
  const j = JSON.parse(raw);
  if (j.app !== '21by21') throw new Error('This is not a 21 by 21 backup.');
  if (typeof j.schemaVersion !== 'number' || j.schemaVersion > SCHEMA_VERSION) throw new Error('This backup comes from a newer version of the app.');
  return { exportedAt: j.exportedAt, schemaVersion: j.schemaVersion, photos: j.blobs?.length ?? 0, meals: j.tables?.meals?.length ?? 0, workouts: j.tables?.workouts?.length ?? 0 };
}

/** replace everything on this phone with the backup's contents (tables + photos) */
export async function importBackup(file: Blob): Promise<void> {
  const { default: JSZip } = await import('jszip');
  await inspectBackup(file);
  const zip = await JSZip.loadAsync(file);
  const j = JSON.parse((await zip.file('data.json')!.async('string')));
  const blobRecs: BlobRec[] = [];
  for (const m of j.blobs as Omit<BlobRec, 'full' | 'thumb'>[]) {
    const full = await zip.file(`photos/${m.id}.jpg`)?.async('blob');
    const thumb = await zip.file(`thumbs/${m.id}.jpg`)?.async('blob');
    if (full && thumb) blobRecs.push({ ...m, full: new Blob([full], { type: 'image/jpeg' }), thumb: new Blob([thumb], { type: 'image/jpeg' }) });
  }
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    const settings = (j.tables.settings as unknown[])?.[0];
    await db.settings.put(mergeSettings(settings as never));
    for (const t of DATA_TABLES) if (j.tables[t]?.length) await db.table(t).bulkPut(j.tables[t]);
    await db.blobs.bulkPut(blobRecs);
  });
}
