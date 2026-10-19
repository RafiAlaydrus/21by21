import { useState } from 'react';
import type { ReactNode } from 'react';

/** tap a mark → tooltip; tap the same mark again → open that day */
export function useSelect(onOpen?: (i: number) => void) {
  const [sel, setSel] = useState<number | null>(null);
  const tap = (i: number) => { if (sel === i) onOpen?.(i); else setSel(i); };
  return { sel, tap, clear: () => setSel(null) };
}

export const FONT = '-apple-system, system-ui, sans-serif';

export function Tip({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: ReactNode }) {
  const left = Math.min(92, Math.max(8, (x / w) * 100));
  return <div className="chart-tip" style={{ left: `${left}%`, top: `${(y / h) * 100}%`, marginTop: -8 }}>{children}</div>;
}

export const niceTicks = (min: number, max: number, n = 3): number[] => {
  if (max <= min) return [min];
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => Math.round((min + step * i) * 10) / 10);
};
