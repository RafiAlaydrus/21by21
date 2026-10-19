import type { ReactNode } from 'react';
import { rgba } from '../theme';

export interface Cell { key: string; bg: string; text?: ReactNode; color?: string; outline?: string; onClick?: () => void; aria: string; dim?: boolean }

/** square-cell grid used for the 24-day calendar and the mini heatmaps */
export function CellGrid({ cells, cols, gap = 8, radius = 10, font = 13 }: { cells: Cell[]; cols: number; gap?: number; radius?: number; font?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
      {cells.map((c) => (
        <button key={c.key} type="button" aria-label={c.aria} onClick={c.onClick} disabled={!c.onClick}
          style={{ aspectRatio: '1', borderRadius: radius, background: c.bg, color: c.color ?? '#fff', fontSize: font, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, outline: c.outline ? `2px solid ${c.outline}` : 'none', outlineOffset: 1, opacity: c.dim ? 0.6 : 1 }}>
          {c.text}
        </button>
      ))}
    </div>
  );
}

/** horizontal bar rows: label · bar · value */
export function HBars({ rows, labelW = 70, valueW = 44 }: { rows: { label: string; pct: number; text: string; color: string; onClick?: () => void }[]; labelW?: number; valueW?: number }) {
  return (
    <div className="stack g8">
      {rows.map((r) => (
        <div key={r.label} className="row g10 t-13" style={{ minHeight: 24 }}>
          <span style={{ width: labelW, flexShrink: 0 }} className="clip">{r.label}</span>
          <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}><span style={{ display: 'block', width: `${Math.max(0, Math.min(100, r.pct))}%`, height: 8, borderRadius: 4, background: r.color }} /></span>
          <span className="num muted ta-right" style={{ width: valueW, flexShrink: 0 }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export const greenCell = (score: number | null) => (score == null ? 'rgba(255,255,255,0.06)' : rgba('#30D158', 0.15 + 0.85 * Math.max(0, Math.min(1, score / 100))));
