import { useEffect, useState } from 'react';
import { db } from './schema';
import { newRec } from './ops';
import type { BlobRec } from './types';

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

/**
 * Canvas → JPEG Blob via the synchronous toDataURL path. canvas.toBlob waits for a rendered frame, so it can stall
 * for a second per call when the page is throttled or backgrounded; this never does.
 */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Blob {
  const url = canvas.toDataURL('image/jpeg', quality);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** Resize to `maxEdge` on the long side and re-encode as JPEG. Originals are never stored. */
export async function compressImage(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const src = await decode(file);
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * k));
  canvas.height = Math.max(1, Math.round(sh * k));
  canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ('close' in src) src.close();
  return canvasToJpeg(canvas, quality);
}

/** full: 1280px q0.75 · thumb: 320px q0.7 (PLAN §3.2). takenAt = file time if within 12 h, else now. */
export async function savePhoto(file: File | Blob, kind: BlobRec['kind']): Promise<string> {
  const [full, thumb] = await Promise.all([compressImage(file, 1280, 0.75), compressImage(file, 320, 0.7)]);
  const lm = (file as File).lastModified;
  const takenAt = lm && Math.abs(Date.now() - lm) < 12 * 3600 * 1000 ? lm : Date.now();
  const rec = newRec({ kind, full, thumb, takenAt }) as BlobRec;
  await db.blobs.put(rec);
  return rec.id;
}

export function useBlobUrl(id: string | undefined, which: 'thumb' | 'full' = 'thumb'): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    let u: string | undefined;
    setUrl(undefined);
    if (!id) return;
    db.blobs.get(id).then((b) => {
      if (!alive || !b) return;
      u = URL.createObjectURL(b[which]);
      setUrl(u);
    });
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id, which]);
  return url;
}

/** Hook for a freshly picked File: object URL for preview. */
export function useFileUrl(file: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) { setUrl(undefined); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}
