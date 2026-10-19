
export const SORE_COLORS = ['rgba(255,255,255,0.13)', 'rgba(255,214,10,0.6)', 'rgba(255,159,10,0.8)', 'rgba(255,55,95,0.92)'];
export const SORE_LABEL = ['None', 'Light', 'Medium', 'High'];
export const SORE_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];

type Vals = Record<string, number | undefined>;
interface Region { id: string; node: (fill: string, props: object) => JSX.Element }

const cap = (x1: number, y1: number, x2: number, y2: number, w: number) => (fill: string, p: object) => <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={fill} strokeWidth={w} strokeLinecap="round" fill="none" {...p} />;
const box = (x: number, y: number, w: number, h: number, r: number) => (fill: string, p: object) => <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} {...p} />;
const pair = (a: (f: string, p: object) => JSX.Element, b: (f: string, p: object) => JSX.Element) => (fill: string, p: object) => <g {...p}>{a(fill, {})}{b(fill, {})}</g>;

const FRONT: Region[] = [
  { id: 'Shoulders', node: pair(box(26, 52, 24, 22, 10), box(90, 52, 24, 22, 10)) },
  { id: 'Chest', node: pair(box(52, 56, 17, 26, 8), box(71, 56, 17, 26, 8)) },
  { id: 'Abs', node: box(54, 86, 32, 54, 9) },
  { id: 'Biceps', node: pair(cap(30, 82, 24, 108, 13), cap(110, 82, 116, 108, 13)) },
  { id: 'Forearms', node: pair(cap(22, 116, 16, 150, 11), cap(118, 116, 124, 150, 11)) },
  { id: 'Quads', node: pair(cap(56, 154, 52, 208, 22), cap(84, 154, 88, 208, 22)) },
  { id: 'Calves', node: pair(cap(52, 220, 50, 268, 15), cap(88, 220, 90, 268, 15)) },
];
const BACK: Region[] = [
  { id: 'Shoulders', node: pair(box(26, 52, 24, 22, 10), box(90, 52, 24, 22, 10)) },
  { id: 'Back', node: box(52, 56, 36, 62, 10) },
  { id: 'Triceps', node: pair(cap(30, 82, 24, 108, 13), cap(110, 82, 116, 108, 13)) },
  { id: 'Forearms', node: pair(cap(22, 116, 16, 150, 11), cap(118, 116, 124, 150, 11)) },
  { id: 'Glutes', node: box(52, 122, 36, 28, 12) },
  { id: 'Hamstrings', node: pair(cap(56, 164, 53, 208, 20), cap(84, 164, 87, 208, 20)) },
  { id: 'Calves', node: pair(cap(52, 220, 50, 268, 15), cap(88, 220, 90, 268, 15)) },
];

function Figure({ regions, vals, onTap, label }: { regions: Region[]; vals: Vals; onTap: (m: string) => void; label: string }) {
  return (
    <svg viewBox="0 0 140 280" role="group" aria-label={label} style={{ width: '100%', height: 'auto' }}>
      <circle cx="70" cy="26" r="17" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.22)" />
      <rect x="64" y="42" width="12" height="12" rx="4" fill="rgba(255,255,255,0.07)" />
      {regions.map((r) => {
        const lv = Math.max(0, Math.min(3, vals[r.id] ?? 0));
        return r.node(SORE_COLORS[lv], { key: r.id, onClick: () => onTap(r.id), style: { cursor: 'pointer' }, role: 'button', 'aria-label': `${r.id}: ${SORE_LABEL[lv]}`, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onTap(r.id) });
      })}
    </svg>
  );
}

/** Front + back outline; tapping a region calls onTap(muscleId) — the caller cycles 0→1→2→3. */
export function BodyMap({ vals, onTap }: { vals: Vals; onTap: (m: string) => void }) {
  return (
    <div className="grid2" style={{ gap: 8 }}>
      <div className="stack col-center"><Figure regions={FRONT} vals={vals} onTap={onTap} label="Front of body" /><span className="t-12 muted">Front</span></div>
      <div className="stack col-center"><Figure regions={BACK} vals={vals} onTap={onTap} label="Back of body" /><span className="t-12 muted">Back</span></div>
    </div>
  );
}
