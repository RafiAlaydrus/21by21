import type { CSSProperties, ReactNode } from 'react';
import { C } from '../theme';
import { fmtDayLong, fmtDuration, fmtInt, fmtMacro } from '../logic/format';
import type { DayAgg } from '../logic/aggregate';

const base: CSSProperties = { background: '#000', color: '#F5F5F7', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif', position: 'relative', overflow: 'hidden', fontVariantNumeric: 'tabular-nums' };
const tile: CSSProperties = { background: 'rgba(255,255,255,0.09)', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 36, padding: '28px 32px' };
const cap: CSSProperties = { fontSize: 26, fontWeight: 700, color: '#8E8E93', letterSpacing: 1, textTransform: 'uppercase' };

function Ring({ v, size, color, stroke = 18 }: { v: number; size: number; color: string; stroke?: number }) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}33`} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len * Math.max(0, Math.min(1, v))} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
const Glow = ({ color, x, y }: { color: string; x: number; y: number }) => <div style={{ position: 'absolute', left: x, top: y, width: 700, height: 700, borderRadius: 350, background: color, opacity: 0.22, filter: 'blur(160px)' }} />;

/** 1080×1350 day card (solid translucent fills — blur is not needed in an export) */
export function DayCard({ day, dayNo, len, score, agg, prCount, photos, mealLabels, exerciseNames }: {
  day: string; dayNo: number | null; len: number; score: number | null; agg: DayAgg; prCount: number; photos: string[]; mealLabels: string[]; exerciseNames: string[];
}) {
  const n = agg.nutrition.total;
  const w = agg.workouts[0];
  const stat = (label: string, value: ReactNode, color?: string) => (
    <div style={{ ...tile, flex: 1 }}><div style={cap}>{label}</div><div style={{ fontSize: 54, fontWeight: 700, letterSpacing: -1, color, marginTop: 6 }}>{value}</div></div>
  );
  return (
    <div style={{ ...base, width: 1080, height: 1350, padding: 64, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Glow color={C.green} x={-200} y={-200} /><Glow color={C.blue} x={600} y={800} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.green, letterSpacing: 1 }}>21 BY 21 · {dayNo === 0 ? 'DAY 0' : dayNo ? `DAY ${dayNo} OF ${len}` : ''}</div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.5, marginTop: 6 }}>{fmtDayLong(day)}</div>
        </div>
        <div style={{ position: 'relative', width: 190, height: 190 }}>
          <Ring v={(score ?? 0) / 100} size={190} color={C.green} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 66, fontWeight: 700 }}>{score != null ? Math.round(score) : '—'}</div>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 20 }}>
        {stat('Calories', `${fmtInt(n.kcal)}`, C.orange)}{stat('Protein', `${fmtMacro(n.protein)} g`, C.green)}{stat('Carbs', `${fmtMacro(n.carbs)} g`)}{stat('Fat', `${fmtMacro(n.fat)} g`, C.yellow)}
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 20 }}>
        {stat('Water', `${fmtInt(agg.nutrition.waterMl)} ml`, C.blue)}{stat('Sleep', agg.nightMin != null ? fmtDuration(agg.nightMin) : '—', C.purple)}{stat('Supps', `${agg.supplementLogs.length}`, C.cyan)}
      </div>
      <div style={{ ...tile, position: 'relative' }}>
        <div style={cap}>Training</div>
        {w ? (
          <>
            <div style={{ fontSize: 46, fontWeight: 700, marginTop: 6 }}>{w.title || 'Session'} · {w.checkOut ? fmtDuration((w.checkOut - w.checkIn) / 60000) : 'in progress'} · {fmtInt(agg.volumeKg)} kg{prCount ? ` · ${prCount} PR${prCount > 1 ? 's' : ''}` : ''}</div>
            <div style={{ fontSize: 30, color: '#AEAEB2', marginTop: 8 }}>{exerciseNames.slice(0, 5).join(' · ')}</div>
          </>
        ) : <div style={{ fontSize: 42, color: '#8E8E93', marginTop: 6 }}>No session</div>}
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {photos.slice(0, 4).map((p, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 28, overflow: 'hidden', position: 'relative', background: '#1C1C1E' }}>
            <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', left: 14, bottom: 14, background: 'rgba(0,0,0,0.65)', padding: '6px 14px', borderRadius: 14, fontSize: 24, fontWeight: 700 }}>{mealLabels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RecapData {
  title: string; range: string; weight: string; waist: string; sessions: string; volume: string; prs: string; score: string; streak: string; protein: string;
  water: string; meals: string; cravings: string; sleep: string; before?: string; after?: string; collage: string[];
}
/** 1080×1920 portrait recap */
export function RecapCard({ r }: { r: RecapData }) {
  const row = (label: string, value: string, color?: string) => (
    <div style={{ ...tile, padding: '22px 28px' }}><div style={cap}>{label}</div><div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1, color, marginTop: 4 }}>{value}</div></div>
  );
  return (
    <div style={{ ...base, width: 1080, height: 1920, padding: 64, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Glow color={C.green} x={-250} y={-250} /><Glow color={C.purple} x={500} y={1200} />
      <div style={{ position: 'relative' }}><div style={{ fontSize: 30, fontWeight: 700, color: C.green, letterSpacing: 1 }}>21 BY 21</div><div style={{ fontSize: 110, fontWeight: 800, letterSpacing: -3 }}>{r.title}</div><div style={{ fontSize: 34, color: '#8E8E93' }}>{r.range}</div></div>
      {(r.before || r.after) && (
        <div style={{ position: 'relative', display: 'flex', gap: 20, height: 520 }}>
          {[r.before, r.after].map((p, i) => <div key={i} style={{ flex: 1, borderRadius: 32, overflow: 'hidden', background: '#1C1C1E' }}>{p && <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>)}
        </div>
      )}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {row('Weight', r.weight)}{row('Waist', r.waist)}{row('Sessions', r.sessions, C.red)}
        {row('Volume', r.volume)}{row('PRs', r.prs, C.yellow)}{row('Avg score', r.score, C.green)}
        {row('Streak', r.streak)}{row('Avg protein', r.protein, C.green)}{row('Water', r.water, C.blue)}
        {row('Meals', r.meals, C.orange)}{row('Cravings', r.cravings)}{row('Avg sleep', r.sleep, C.purple)}
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, flex: 1, minHeight: 0, alignContent: 'start' }}>
        {r.collage.slice(0, 32).map((p, i) => <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 14 }} />)}
      </div>
    </div>
  );
}
