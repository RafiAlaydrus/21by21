/**
 * Pull-to-refresh action. Asks the service worker whether a newer build exists; if one is found it waits for the
 * new worker to finish installing (it precaches the whole app first) and reports 'updated' so the caller can reload
 * into it. Without a service worker (plain http / dev server) there is nothing to compare, so the caller just reloads.
 */
export type UpdateResult = 'updated' | 'current' | 'offline' | 'none';

export async function checkForUpdate(): Promise<UpdateResult> {
  if (!('serviceWorker' in navigator)) return 'none';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'none';
  try { await reg.update(); } catch { return 'offline'; }
  const sw = reg.installing ?? reg.waiting;
  if (!sw) return 'current';
  if (sw.state !== 'activated') {
    await new Promise<void>((done) => {
      const t = window.setTimeout(done, 25000);
      sw.addEventListener('statechange', () => { if (sw.state === 'activated' || sw.state === 'redundant') { window.clearTimeout(t); done(); } });
    });
  }
  return 'updated';
}
