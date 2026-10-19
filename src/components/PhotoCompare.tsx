import { useRef, useState } from 'react';
import { useBlobUrl } from '../db/photos';

/** Drag the divider between two photos of the same pose (left = earlier, right = later). */
export function PhotoCompare({ leftId, rightId, leftLabel, rightLabel }: { leftId?: string; rightId?: string; leftLabel: string; rightLabel: string }) {
  const a = useBlobUrl(leftId, 'full');
  const b = useBlobUrl(rightId, 'full');
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const move = (x: number) => { const r = box.current!.getBoundingClientRect(); setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100))); };
  return (
    <div ref={box} className="slider-compare" role="slider" aria-label="Photo comparison divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} tabIndex={0}
      style={{ aspectRatio: '3 / 4', background: '#1C1C1E', cursor: 'ew-resize' }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') move(e.clientX); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5)); if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5)); }}>
      {b && <img src={b} alt={rightLabel} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {a && <img src={a} alt={leftLabel} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
      <span className="tag" style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{leftLabel}</span>
      <span className="tag" style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{rightLabel}</span>
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, marginLeft: -1, background: '#fff' }}>
        <span style={{ position: 'absolute', top: '50%', left: -15, width: 32, height: 32, marginTop: -16, borderRadius: 16, background: 'rgba(255,255,255,0.9)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg></span>
      </div>
    </div>
  );
}
