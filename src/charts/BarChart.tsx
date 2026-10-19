import { Tip, FONT, useSelect } from './common';

export interface BarItem { v: number; color: string; max?: number }
export interface BarGroup { key: string; label?: string; dayKey?: string; tip?: string; items: BarItem[]; dim?: boolean }

/** Grouped (side by side) or stacked bars. Each item may carry its own max so differently-scaled series share a chart. */
export function BarChart({ groups, w = 326, h = 130, yMax, targetFrac, targetColor = 'rgba(255,255,255,0.4)', mode = 'group', aria, onOpenDay, barMax = 24, labelEvery = 1, line }: {
  groups: BarGroup[]; w?: number; h?: number; yMax?: number; targetFrac?: number; targetColor?: string; mode?: 'group' | 'stack'; aria: string; onOpenDay?: (k: string) => void; barMax?: number; labelEvery?: number;
  line?: { color: string; values: (number | null)[]; max: number };
}) {
  const L = 4, R = 4, T = 10, B = groups.some((g) => g.label) ? 22 : 6;
  const pw = w - L - R, ph = h - T - B;
  const gw = pw / Math.max(1, groups.length);
  const { sel, tap } = useSelect((i) => { const k = groups[i]?.dayKey; if (k) onOpenDay?.(k); });
  const total = (g: BarGroup) => g.items.reduce((a, b) => a + b.v, 0);
  const ymax = yMax ?? Math.max(1, ...groups.map((g) => (mode === 'stack' ? total(g) : Math.max(...g.items.map((i) => i.v)))));
  const bw = mode === 'stack' ? Math.min(barMax, gw * 0.7) : Math.min(barMax, (gw * 0.8) / Math.max(1, groups[0]?.items.length ?? 1));
  const sel_ = sel != null ? groups[sel] : undefined;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria}>
        <line x1={L} x2={w - R} y1={T + ph} y2={T + ph} stroke="rgba(255,255,255,0.08)" />
        {targetFrac != null && <line x1={L} x2={w - R} y1={T + ph * (1 - targetFrac)} y2={T + ph * (1 - targetFrac)} stroke={targetColor} strokeDasharray="3 4" />}
        {groups.map((g, gi) => {
          const cx = L + gw * gi + gw / 2;
          let acc = 0;
          return (
            <g key={g.key} opacity={g.dim ? 0.45 : 1}>
              {g.items.map((it, ii) => {
                const hh = Math.max(it.v > 0 ? 2 : 0, (it.v / (it.max ?? ymax)) * ph);
                if (mode === 'stack') { const y = T + ph - acc - hh; acc += hh; return <rect key={ii} x={cx - bw / 2} y={y} width={bw} height={hh} rx={ii === g.items.length - 1 ? 3 : 0} fill={it.color} />; }
                const x = cx - (bw * g.items.length) / 2 + ii * bw;
                return <rect key={ii} x={x + 0.5} y={T + ph - hh} width={bw - 1} height={hh} rx={3} fill={it.color} />;
              })}
              {g.label && gi % labelEvery === 0 && <text x={cx} y={h - 6} fill="#8E8E93" fontSize="10" textAnchor="middle" fontFamily={FONT}>{g.label}</text>}
              {sel === gi && <rect x={cx - gw / 2 + 1} y={T - 4} width={gw - 2} height={ph + 4} rx={4} fill="rgba(255,255,255,0.06)" />}
              <rect x={cx - gw / 2} y={0} width={gw} height={h} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => tap(gi)} />
            </g>
          );
        })}
        {line && (
          <polyline fill="none" stroke={line.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
            points={line.values.map((v, i) => (v == null ? null : `${L + gw * i + gw / 2},${T + ph * (1 - v / line.max)}`)).filter(Boolean).join(' ')} />
        )}
      </svg>
      {sel_?.tip && sel != null && <Tip x={L + gw * sel + gw / 2} y={T} w={w} h={h}>{sel_.tip}{sel_.dayKey && onOpenDay ? <div className="muted t-11">tap again to open day</div> : null}</Tip>}
    </div>
  );
}
