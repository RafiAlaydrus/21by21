import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Segmented } from '../../components/ui';
import { PhotoCompare } from '../../components/PhotoCompare';
import { SORE_COLORS, SORE_MUSCLES } from '../../components/BodyMap';
import { useBlobUrl } from '../../db/photos';
import { LineChart } from '../../charts/LineChart';
import { useData } from '../../hooks/useData';
import type { Analysis } from '../../hooks/useAnalysis';
import { diffDays } from '../../logic/dates';
import { weightSegments } from '../../logic/stats';
import { fmt1, fmtDay, signed } from '../../logic/format';
import { Mini, StatCard } from './common';
import { C } from '../../theme';

function Shot({ blobId, label }: { blobId?: string; label: string }) {
  const url = useBlobUrl(blobId, 'thumb');
  return <div className="photo-ph" style={{ aspectRatio: '3 / 4', borderRadius: 14 }}>{url ? <img src={url} alt={label} /> : <span>{label}</span>}</div>;
}

export function Body({ an }: { an: Analysis }) {
  const nav = useNavigate();
  const d = useData();
  const c = d.settings.challenge;
  const [pose, setPose] = useState<'front' | 'side' | 'back'>('front');

  /* ---- weight ---- */
  const weigh = useMemo(() => [...d.weighIns].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.time - b.time), [d.weighIns]);
  const segs = weightSegments(weigh);
  const first = weigh[0], last = weigh.at(-1);
  const total = first && last && first !== last ? last.kg - first.kg : null;
  const wks = first && last ? Math.max(1, diffDays(first.dayKey, last.dayKey)) / 7 : 1;
  const x = (k: string) => diffDays(c.baselineDate, k);
  const sched = [...new Set(c.weighInDates)].filter((k) => !weigh.some((w) => w.dayKey === k) && k > (last?.dayKey ?? c.baselineDate)).sort();
  const wMin = weigh.length ? Math.min(...weigh.map((w) => w.kg)) : 0, wMax = weigh.length ? Math.max(...weigh.map((w) => w.kg)) : 1;
  const xl = [...new Set([...weigh.map((w) => w.dayKey), ...sched])].sort();
  const maxRate = Math.max(0.0001, ...segs.map((s) => Math.abs(s.perWeek)));

  /* ---- measurements ---- */
  const meas = [...d.measurements].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const m0 = meas[0], m1 = meas.length > 1 ? meas.at(-1) : undefined;
  const rows = d.settings.bodyParts.filter((b) => m0?.values[b.id] != null).map((b) => ({ b, v0: m0!.values[b.id], v1: m1?.values[b.id] }));
  const maxV = Math.max(1, ...rows.flatMap((r) => [r.v0, r.v1 ?? 0]));
  const call = (re: RegExp) => rows.find((r) => re.test(r.b.name));
  const chip = (re: RegExp, side: 'left' | 'right', top: number, label: string) => {
    const r = call(re); if (!r || r.v1 == null) return null;
    const ch = r.v1 - r.v0;
    return (
      <div key={label} className="glass-btn num" style={{ position: 'absolute', [side]: 0, top, borderRadius: 12, padding: '6px 9px', fontSize: 12, lineHeight: 1.3 }}>
        <div className="muted b600" style={{ textTransform: 'uppercase' }}>{label}</div>{fmt1(r.v0)} → {fmt1(r.v1)} <span style={{ color: ch <= 0 ? C.green : C.blue }}>{signed(ch)}</span>
      </div>
    );
  };

  /* ---- photos ---- */
  const poseShots = d.progressPhotos.filter((p) => p.pose === pose).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const [li, setLi] = useState<number | null>(null), [ri, setRi] = useState<number | null>(null);
  const L = poseShots[Math.min(li ?? 0, Math.max(0, poseShots.length - 1))], R = poseShots[Math.min(ri ?? poseShots.length - 1, Math.max(0, poseShots.length - 1))];

  /* ---- soreness ---- */
  const days = an.cdays.filter((k) => k <= an.today);

  return (
    <>
      <StatCard title="Weight" right="Weigh-in days">
        <div className="grid4" style={{ gap: 6 }}>
          <Mini label="Start" value={first ? fmt1(first.kg) : '—'} />
          <Mini label="Latest" value={last ? fmt1(last.kg) : '—'} />
          <Mini label="Total" value={total == null ? '—' : signed(total)} />
          <Mini label="Per week" value={total == null ? '—' : signed(total / wks)} />
        </div>
        {weigh.length === 0 ? <div className="muted t-13">No weigh-ins yet</div> : (
          <LineChart h={150} xDomain={[0, Math.max(1, diffDays(c.baselineDate, c.endDate))]} yDomain={[wMin - 1.2, wMax + 1.2]} yTicks={[]} aria={`Weight on ${weigh.map((w) => `${fmtDay(w.dayKey, 'd MMM')} ${fmt1(w.kg)}`).join(', ')}`}
            xLabels={xl.map((k, i) => ({ x: x(k), text: fmtDay(k, 'd MMM'), anchor: i === 0 ? 'start' : i === xl.length - 1 ? 'end' : 'middle' }))} onOpenDay={(k) => nav(`/day/${k}`)}
            series={[
              { color: C.text, dots: true, labels: true, points: weigh.map((w) => ({ x: x(w.dayKey), y: w.kg, label: fmt1(w.kg), dayKey: w.dayKey, tip: `${fmt1(w.kg)} kg · ${fmtDay(w.dayKey, 'EEE d MMM')}` })) },
              { color: C.text, points: sched.map((k) => ({ x: x(k), y: last?.kg ?? null, hollow: true })) },
            ]} />
        )}
        <div className="stack g8">
          {segs.map((s) => (
            <div key={s.to.id} className="row g10 t-13">
              <span className="num muted" style={{ width: 104, flexShrink: 0 }}>{fmtDay(s.from.dayKey, 'd MMM')} → {fmtDay(s.to.dayKey, 'd MMM')}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}><span style={{ display: 'block', width: `${(Math.abs(s.perWeek) / maxRate) * 100}%`, height: 8, borderRadius: 4, background: s.delta <= 0 ? C.green : C.blue }} /></span>
              <span className="num ta-right" style={{ width: 96, flexShrink: 0 }}>{signed(s.delta)} · {fmt1(Math.abs(s.perWeek))}/wk</span>
            </div>
          ))}
        </div>
      </StatCard>

      <StatCard title="Measurements" right={m0 ? `${fmtDay(m0.dayKey, 'd MMM')}${m1 ? ` vs ${fmtDay(m1.dayKey, 'd MMM')}` : ''}` : undefined}>
        {rows.length === 0 ? <div className="muted t-13">No measurements yet</div> : (
          <>
            <div style={{ position: 'relative', height: 300, display: 'flex', justifyContent: 'center' }}>
              <svg width="140" height="300" viewBox="0 0 140 300" aria-hidden="true">
                <circle cx="70" cy="26" r="18" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.25)" />
                <path d="M40 54 Q70 46 100 54 L108 140 Q70 150 32 140 Z" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.25)" />
                <path d="M38 58 L18 150" stroke="rgba(255,255,255,0.25)" strokeWidth="14" strokeLinecap="round" />
                <path d="M102 58 L122 150" stroke="rgba(255,255,255,0.25)" strokeWidth="14" strokeLinecap="round" />
                <path d="M50 146 L46 280" stroke="rgba(255,255,255,0.25)" strokeWidth="18" strokeLinecap="round" />
                <path d="M90 146 L94 280" stroke="rgba(255,255,255,0.25)" strokeWidth="18" strokeLinecap="round" />
              </svg>
              {chip(/chest/i, 'left', 64, 'Chest')}{chip(/arm/i, 'right', 88, 'Arm')}{chip(/waist/i, 'left', 138, 'Waist')}{chip(/thigh/i, 'right', 196, 'Thigh')}
            </div>
            <div className="stack g12">
              {rows.map((r) => {
                const pct = r.v1 != null ? ((r.v1 - r.v0) / r.v0) * 100 : null;
                return (
                  <div key={r.b.id} className="stack g4">
                    <div className="row between num t-13"><span className="b600">{r.b.name}</span><span><span className="muted">{fmt1(r.v0)}{r.v1 != null ? ` → ${fmt1(r.v1)}` : ''} cm</span>{pct != null && <span className="b600" style={{ color: pct <= 0 ? C.green : C.blue }}> {signed(pct)}%</span>}</span></div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.18)', width: `${(r.v0 / maxV) * 100}%` }} />
                    {r.v1 != null && <div style={{ height: 6, borderRadius: 3, background: r.v1 <= r.v0 ? C.green : C.blue, width: `${(r.v1 / maxV) * 100}%` }} />}
                  </div>
                );
              })}
              {m1 && <div className="row g14 t-12 muted" style={{ gap: 14 }}><span className="row g6"><span style={{ width: 10, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.18)' }} />{fmtDay(m0!.dayKey, 'd MMM')}</span><span className="row g6"><span style={{ width: 10, height: 6, borderRadius: 3, background: C.green }} />{fmtDay(m1.dayKey, 'd MMM')}</span></div>}
            </div>
          </>
        )}
      </StatCard>

      <StatCard title="Progress photos" right={`${d.progressPhotos.length} photos`}>
        <Segmented value={pose} onChange={(p) => { setPose(p); setLi(null); setRi(null); }} options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
        {poseShots.length === 0 ? <div className="muted t-13">No {pose} photos yet</div> : (
          <>
            <div className="grid3">{poseShots.map((p, i) => (
              <button key={p.id} type="button" className="stack g4" aria-label={`${pose} photo ${fmtDay(p.dayKey, 'd MMM')}`} onClick={() => (i === (li ?? 0) ? setRi(i) : setLi(i))}>
                <Shot blobId={p.blobId} label={p.dayKey} /><span className="num t-11 muted">{fmtDay(p.dayKey, 'd MMM')}</span>
              </button>
            ))}</div>
            {poseShots.length > 1 && (
              <>
                <div className="t-13 muted">Tap a photo to set the left side; tap the left one again to set the right.</div>
                <PhotoCompare leftId={L?.blobId} rightId={R?.blobId} leftLabel={fmtDay(L?.dayKey ?? c.baselineDate, 'd MMM')} rightLabel={fmtDay(R?.dayKey ?? c.endDate, 'd MMM')} />
              </>
            )}
          </>
        )}
      </StatCard>

      <StatCard title="Soreness history">
        {d.soreness.length === 0 ? <div className="muted t-13">No soreness logged</div> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `76px repeat(${days.length}, minmax(14px, 1fr))`, gap: 3, minWidth: 300 }}>
              {SORE_MUSCLES.map((m) => (
                <div key={m} style={{ display: 'contents' }}>
                  <span className="t-12 muted" style={{ alignSelf: 'center' }}>{m}</span>
                  {days.map((k) => {
                    const lv = d.soreness.find((s) => s.dayKey === k)?.muscles[m] ?? 0;
                    return <button key={k} type="button" aria-label={`${m} ${fmtDay(k, 'd MMM')} level ${lv}`} onClick={() => nav(`/day/${k}`)} style={{ aspectRatio: '1', borderRadius: 4, background: SORE_COLORS[lv] }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </StatCard>
    </>
  );
}
