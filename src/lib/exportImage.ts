import { useEffect, useState } from 'react';
import { db } from '../db/schema';

export const blobToDataUrl = (b: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });

/** photo ids → data URLs (html-to-image inlines these reliably) */
export function useDataUrls(ids: string[], which: 'thumb' | 'full' = 'thumb'): Record<string, string> | null {
  const [m, setM] = useState<Record<string, string> | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    let alive = true;
    setM(null);
    (async () => {
      const out: Record<string, string> = {};
      for (const id of ids) { const b = await db.blobs.get(id); if (b) out[id] = await blobToDataUrl(b[which]); }
      if (alive) setM(out);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, which]);
  return m;
}

/** render a DOM node to a PNG blob; html-to-image is lazy-loaded */
export async function nodeToPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  await Promise.all([...node.querySelectorAll('img')].map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))));
  const b = await toBlob(node, { width, height, pixelRatio: 1, cacheBust: false, backgroundColor: '#000000' });
  if (!b) throw new Error('Could not render the image');
  return b;
}
