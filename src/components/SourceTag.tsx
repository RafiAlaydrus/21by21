import type { FoodSource } from '../db/types';
import { C, rgba } from '../theme';

const SRC: Record<FoodSource, [string, string]> = {
  label: ['LABEL', C.green], barcode: ['BARCODE', C.green], usda: ['DATABASE', C.cyan], myfcd: ['MYFCD', C.cyan],
  tkpi: ['TKPI', C.purpleLight], user: ['YOU', C.yellow],
};
export const sourceLabel = (s: FoodSource) => SRC[s][0];

export function SourceTag({ source, l }: { source: FoodSource; l?: boolean }) {
  const [label, color] = SRC[source];
  const bg = source === 'usda' || source === 'myfcd' ? 'rgba(10,132,255,0.22)' : source === 'tkpi' ? 'rgba(191,90,242,0.22)' : rgba(color, 0.2);
  return <span className={`tag ${l ? 'l' : ''}`} style={{ color, background: bg }}>{label}</span>;
}

export function StateTag({ state }: { state?: 'raw' | 'cooked' }) {
  return state ? <span className="tag l" style={{ background: 'rgba(255,255,255,0.12)', color: C.text }}>{state.toUpperCase()}</span> : null;
}
