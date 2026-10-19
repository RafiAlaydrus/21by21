import type { ReactNode } from 'react';
import { Card } from '../../components/ui';
import type { Analysis } from '../../hooks/useAnalysis';

/** days of the challenge that are not in the future */
export const pastDays = (an: Analysis) => an.cdays.filter((k) => k <= an.today);

export function StatCard({ title, right, children, lg = true }: { title: string; right?: ReactNode; children: ReactNode; lg?: boolean }) {
  return (
    <Card lg={lg}>
      <div className="row between baseline"><h2 className="t-card">{title}</h2>{right != null && <div className="num t-13 muted">{right}</div>}</div>
      {children}
    </Card>
  );
}

export function Tile({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="glass stack g4" style={{ borderRadius: 20, padding: 12 }}>
      <div className="t-11 b600 muted" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color }}>{value}{unit && <span style={{ fontSize: 14, color: color ?? 'var(--text-2)' }}>{unit.startsWith('/') ? unit : ` ${unit}`}</span>}</div>
    </div>
  );
}

export const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="stack g2"><div className="t-11 b600 muted" style={{ textTransform: 'uppercase' }}>{label}</div><div className="num t-17 b700">{value}</div></div>
);

export const Legend = ({ items }: { items: [string, string][] }) => (
  <div className="row wrap g14 t-12 muted" style={{ gap: 14 }}>{items.map(([l, c]) => <span key={l} className="row g6"><span style={{ width: 10, height: 6, borderRadius: 3, background: c }} />{l}</span>)}</div>
);
