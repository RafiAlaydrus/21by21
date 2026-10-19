import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Btn } from './ui';
import { nodeToPng } from '../lib/exportImage';
import { saveFile } from '../db/backup';
import { useToast } from './Toast';

/** Renders `card` off-screen at full size, converts it to a PNG, previews it and offers Share / Save. */
export function ExportImageSheet({ open, onClose, title, width, height, fileName, ready = true, children }: {
  open: boolean; onClose: () => void; title: string; width: number; height: number; fileName: string; ready?: boolean; children: ReactNode;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!open || !ready) return;
    let alive = true;
    setPng(null); setErr('');
    const t = window.setTimeout(async () => {
      try { const b = await nodeToPng(node.current!, width, height); if (alive) setPng(b); } catch { if (alive) setErr('Could not render the image on this device.'); }
    }, 350);
    return () => { alive = false; window.clearTimeout(t); };
  }, [open, ready, width, height]);
  useEffect(() => { if (!png) { setUrl(''); return; } const u = URL.createObjectURL(png); setUrl(u); return () => URL.revokeObjectURL(u); }, [png]);

  return (
    <>
      {/* the wrapper is moved off-screen; the captured node itself sits at 0,0 so no offset leaks into the render */}
      {open && <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width, height, pointerEvents: 'none' }}><div ref={node} style={{ width, height }}>{children}</div></div>}
      <Sheet open={open} onClose={onClose} title={title} tall closeLabel="Close">
        <div className="photo-ph" style={{ aspectRatio: `${width} / ${height}`, borderRadius: 18, maxHeight: '58vh', margin: '0 auto' }}>{url ? <img src={url} alt="Preview" style={{ objectFit: 'contain' }} /> : <span>{err || 'Rendering…'}</span>}</div>
        <Btn block tint="#30D158" tintA={0.45} disabled={!png} onClick={async () => { if (png) { const r = await saveFile(png, fileName, 'image/png'); toast(r === 'shared' ? 'Shared' : 'Saved to downloads'); } }}>Share or save image</Btn>
      </Sheet>
    </>
  );
}
