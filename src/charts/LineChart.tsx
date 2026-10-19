import { Tip, FONT, useSelect } from './common';

export interface LinePoint { x: number; y: number | null; dayKey?: string; tip?: string; label?: string; hollow?: boolean }
export interface LineSeries { color: string; points: LinePoint[]; dashed?: boolean; dots?: boolean; strokeW?: number; labels?: boolean; connect?: boolean; lastDot?: boolean }

export function LineChart({ series, w = 326, h = 140, xDomain, yDomain, yTicks, yLabels, xLabels, target, targetColor = 'rgba(255,255,255,0.35)', aria, onOpenDay, fmtTick }: {
  series: LineSeries[]; w?: number; h?: number; xDomain: [number, number]; yDomain: [number, number]; yTicks?: number[]; yLabels?: boolean;
  xLabels?: { x: number; text: string; anchor?: 'start' | 'middle' | 'end' }[]; target?: number; targetColor?: string; aria: string; onOpenDay?: (dayKey: string) => void; fmtTick?: (n: number) => string;
}) {
  const L = yLabels ? 28 : 10, R = 10, T = 16, B = xLabels ? 24 : 10;
  const [x0, x1] = xDomain, [y0, y1] = yDomain;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (w - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (h - T - B);
  const flat = series.flatMap((s, si) => s.points.map((p, pi) => ({ s, p, si, pi }))).filter((o) => o.p.y != null);
  const { sel, tap } = useSelect((i) => { const k = flat[i]?.p.dayKey; if (k) onOpenDay?.(k); });
  const selected = sel != null ? flat[sel] : undefined;

  const segments = (s: LineSeries) => {
    const out: LinePoint[][] = []; let cur: LinePoint[] = [];
    for (const p of s.points) { if (p.y == null) { if (!s.connect && cur.length) { out.push(cur); cur = []; } } else cur.push(p); }
    if (cur.length) out.push(cur);
    return out;
  };
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria}>
        {[...new Set(yTicks ?? [])].map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={sy(t)} y2={sy(t)} stroke="rgba(255,255,255,0.07)" />
            {yLabels && <text x={0} y={sy(t) + 3.5} fill="#8E8E93" fontSize="10" fontFamily={FONT}>{fmtTick ? fmtTick(t) : t}</text>}
          </g>
        ))}
        {target != null && <line x1={L} x2={w - R} y1={sy(target)} y2={sy(target)} stroke={targetColor} strokeDasharray="3 4" />}
        {series.map((s, si) => !s.points.every((p) => p.hollow) && segments(s).map((seg, k) => seg.length > 1 && (
          <polyline key={`${si}-${k}`} points={seg.map((p) => `${sx(p.x)},${sy(p.y!)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.strokeW ?? 2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '4 5' : undefined} />
        )))}
        {series.map((s, si) => s.points.map((p, pi) => {
          if (p.y == null) return null;
          const last = pi === s.points.length - 1 || s.points.slice(pi + 1).every((q) => q.y == null);
          if (!(s.dots || (s.lastDot && last) || p.hollow)) return null;
          return p.hollow
            ? <circle key={`${si}-${pi}`} cx={sx(p.x)} cy={sy(p.y)} r={5} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
            : <circle key={`${si}-${pi}`} cx={sx(p.x)} cy={sy(p.y)} r={s.lastDot && last ? 5.5 : 5} fill={s.color} stroke="#000" strokeWidth={s.lastDot && last ? 2 : 0} />;
        }))}
        {series.map((s, si) => s.labels && s.points.map((p, pi) => p.y != null && p.label && !p.hollow && (
          <text key={`l${si}-${pi}`} x={sx(p.x)} y={sy(p.y) - 11} fill="#F5F5F7" fontSize="11" fontWeight="600" textAnchor={pi === 0 ? 'start' : pi === s.points.length - 1 ? 'end' : 'middle'} fontFamily={FONT}>{p.label}</text>
        )))}
        {(xLabels ?? []).map((l, i) => <text key={i} x={sx(l.x)} y={h - 5} fill="#8E8E93" fontSize="10.5" textAnchor={l.anchor ?? 'middle'} fontFamily={FONT}>{l.text}</text>)}
        {selected && <circle cx={sx(selected.p.x)} cy={sy(selected.p.y!)} r={9} fill="none" stroke={selected.s.color} strokeWidth={2} />}
        {flat.map((o, i) => <circle key={i} cx={sx(o.p.x)} cy={sy(o.p.y!)} r={13} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => tap(i)} />)}
      </svg>
      {selected && selected.p.tip && <Tip x={sx(selected.p.x)} y={sy(selected.p.y!)} w={w} h={h}>{selected.p.tip}{selected.p.dayKey && onOpenDay ? <div className="muted t-11">tap again to open day</div> : null}</Tip>}
    </div>
  );
}
