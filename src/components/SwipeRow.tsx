import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

const W = 92;
/** Swipe left to reveal Delete; a plain tap calls onTap. */
export function SwipeRow({ children, onDelete, onTap }: { children: ReactNode; onDelete: () => void; onTap?: () => void }) {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const s = useRef<{ x: number; base: number; moved: boolean } | null>(null);
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button type="button" onClick={onDelete} aria-label="Delete" tabIndex={x === 0 ? -1 : 0}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: W, background: 'rgba(255,55,95,0.85)', color: '#fff', fontWeight: 700, fontSize: 15, opacity: x === 0 ? 0 : 1, pointerEvents: x === 0 ? 'none' : 'auto', transition: 'opacity 120ms' }}>Delete</button>
      <div style={{ transform: `translateX(${x}px)`, transition: drag ? 'none' : 'transform 160ms ease-out', touchAction: 'pan-y', background: 'transparent' }}
        onPointerDown={(e) => { s.current = { x: e.clientX, base: x, moved: false }; setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          const st = s.current; if (!st) return;
          const dx = e.clientX - st.x;
          if (Math.abs(dx) > 6) st.moved = true;
          if (st.moved) setX(Math.max(-W, Math.min(0, st.base + dx)));
        }}
        onPointerUp={() => {
          const st = s.current; s.current = null; setDrag(false);
          if (!st) return;
          if (st.moved) setX(x < -W / 2 ? -W : 0);
          else if (x !== 0) setX(0);
          else onTap?.();
        }}
        onPointerCancel={() => { s.current = null; setDrag(false); setX(0); }}>
        {children}
      </div>
    </div>
  );
}
