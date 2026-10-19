import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PtrPhase = 'idle' | 'pull' | 'ready' | 'busy';
const READY = 58; // px of (damped) pull needed to trigger
const MAX = 84;

/**
 * Pull down from the very top of the scroller to run `onRefresh`. The scroller and the indicator are moved by
 * writing styles directly (no React re-render per touch move); only the phase label goes through state.
 */
export function usePullToRefresh(scroller: RefObject<HTMLElement>, indicator: RefObject<HTMLElement>, enabled: boolean, onRefresh: () => Promise<void>) {
  const [phase, setPhase] = useState<PtrPhase>('idle');
  const phaseRef = useRef<PtrPhase>('idle');
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    const el = scroller.current, ind = indicator.current;
    if (!el || !ind || !enabled) return;
    let y0 = 0, x0 = 0, active = false, decided = false, pull = 0;
    const set = (p: PtrPhase) => { phaseRef.current = p; setPhase(p); };
    const paint = (p: number, animate: boolean) => {
      pull = p;
      el.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      el.style.transform = p > 0 ? `translateY(${p}px)` : '';
      ind.style.transition = animate ? 'opacity 160ms' : 'none';
      ind.style.opacity = String(Math.min(1, p / 36));
    };
    const start = (e: TouchEvent) => {
      if (phaseRef.current === 'busy' || e.touches.length !== 1 || el.scrollTop > 0) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; active = true; decided = false;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0], dy = t.clientY - y0, dx = t.clientX - x0;
      if (!decided) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        decided = true;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { active = false; return; } // upward or sideways: not ours
      }
      if (el.scrollTop > 0 || e.touches.length !== 1) { active = false; paint(0, true); set('idle'); return; }
      e.preventDefault(); // stop the rubber-band; we draw our own
      const p = Math.min(MAX, dy * 0.5);
      paint(p, false);
      const next: PtrPhase = p >= READY ? 'ready' : 'pull';
      if (next !== phaseRef.current) set(next);
    };
    const end = () => {
      if (!active) return;
      active = false;
      if (pull >= READY) {
        set('busy');
        paint(READY, true);
        refresh.current().finally(() => { paint(0, true); set('idle'); });
      } else { paint(0, true); set('idle'); }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end);
      el.style.transform = ''; el.style.transition = '';
    };
  }, [scroller, indicator, enabled]);

  return phase;
}
