import { Tip, FONT, useSelect } from './common';

export interface ScatterPoint { x: number; y: number; key: string; tip?: string }
export function Scatter({ points, color, w = 326, h = 170, xLabel, yLabel, aria, onOpenDay, line }: {
  points: ScatterPoint[]; color: string; w?: number; h?: number; xLabel: string; yLabel: string; aria: string; onOpenDay?: (k: string) => void; line?: boolean;
}) {
  const L = 34, R = 10, T = 8, B = 30;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const pad = (a: number, b: number) => { const d = (b - a) || Math.max(1, Math.abs(a) * 0.1); return [a - d * 0.08, b + d * 0.08] as const; };
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs)), [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (w - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (h - T - B);
  const { sel, tap } = useSelect((i) => onOpenDay?.(points[i].key));
  const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10));
  // least-squares trend line (a visual aid only; r is shown by the caller)
  let reg: [number, number, number, number] | null = null;
  if (line && points.length > 2) {
    const n = points.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, b) => a + (b - mx) ** 2, 0), sxy = xs.reduce((a, b, i) => a + (b - mx) * (ys[i] - my), 0);
    if (sxx > 0) { const m = sxy / sxx, c = my - m * mx; reg = [sx(x0), sy(m * x0 + c), sx(x1), sy(m * x1 + c)]; }
  }
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria}>
        <line x1={L} x2={w - R} y1={h - B} y2={h - B} stroke="rgba(255,255,255,0.15)" />
        <line x1={L} x2={L} y1={T} y2={h - B} stroke="rgba(255,255,255,0.15)" />
        {[0, 1, 2].map((i) => <text key={`x${i}`} x={L + ((w - L - R) * i) / 2} y={h - B + 13} fill="#8E8E93" fontSize="10" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontFamily={FONT}>{fmt(x0 + ((x1 - x0) * i) / 2)}</text>)}
        {[0, 1, 2].map((i) => <text key={`y${i}`} x={L - 5} y={h - B - ((h - B - T) * i) / 2 + 3} fill="#8E8E93" fontSize="10" textAnchor="end" fontFamily={FONT}>{fmt(y0 + ((y1 - y0) * i) / 2)}</text>)}
        <text x={(L + w - R) / 2} y={h - 2} fill="#8E8E93" fontSize="11" textAnchor="middle" fontFamily={FONT}>{xLabel}</text>
        <text x={8} y={(T + h - B) / 2} fill="#8E8E93" fontSize="11" textAnchor="middle" transform={`rotate(-90 8 ${(T + h - B) / 2})`} fontFamily={FONT}>{yLabel}</text>
        {reg && <line x1={reg[0]} y1={reg[1]} x2={reg[2]} y2={reg[3]} stroke={color} strokeOpacity={0.45} strokeDasharray="4 4" />}
        {points.map((p, i) => <circle key={p.key} cx={sx(p.x)} cy={sy(p.y)} r={sel === i ? 7 : 5} fill={color} fillOpacity={0.85} stroke={sel === i ? '#fff' : 'none'} />)}
        {points.map((p, i) => <circle key={`h${p.key}`} cx={sx(p.x)} cy={sy(p.y)} r={13} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => tap(i)} />)}
      </svg>
      {sel != null && points[sel]?.tip && <Tip x={sx(points[sel].x)} y={sy(points[sel].y)} w={w} h={h}>{points[sel].tip}<div className="muted t-11">tap again to open day</div></Tip>}
    </div>
  );
}
