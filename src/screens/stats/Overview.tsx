import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card, Chip, Switch } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { LineChart } from '../../charts/LineChart';
import { Scatter } from '../../charts/Scatter';
import { CellGrid, greenCell } from '../../charts/bits';
import { useData } from '../../hooks/useData';
import type { Analysis } from '../../hooks/useAnalysis';
import { buildPairs, defined, mean, METRICS, pearson } from '../../logic/stats';
import { isWork } from '../../logic/prs';
import { weekdayMon0, dayKey as dayKeyOf } from '../../logic/dates';
import { fmt1, fmtDay, fmtDuration, fmtInt, fmtMacro, signed } from '../../logic/format';
import { exName } from '../train/bits';
import { Legend, StatCard, Tile, pastDays } from './common';
import { C } from '../../theme';

export function Overview({ an }: { an: Analysis }) {
  const nav = useNavigate();
  const d = useData();
  const { settings } = d;
  const days = pastDays(an);
  const [pick, setPick] = useState(false);
  const [xId, setX] = useState('sleep');
  const [yId, setY] = useState('energy');
  const [next, setNext] = useState(true);

  /* ---- tiles ---- */
  const done = d.workouts.filter((w) => w.dayKey >= settings.challenge.startDate && w.dayKey <= an.today && (w.sets.some((s) => s.doneAt) || w.cardio.length)).length;
  const expected = days.filter((k) => settings.trainingDays[weekdayMon0(k)]).length;
  const weigh = [...d.weighIns].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.time - b.time);
  const wDelta = weigh.length > 1 ? weigh.at(-1)!.kg - weigh[0].kg : null;
  const waistId = settings.bodyParts.find((b) => /waist/i.test(b.name))?.id;
  const meas = [...d.measurements].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const waists = waistId ? meas.filter((m) => m.values[waistId] != null) : [];
  const waistDelta = waists.length > 1 ? waists.at(-1)!.values[waistId!] - waists[0].values[waistId!] : null;
  const prCount = new Set(an.prs.map((p) => `${p.workoutId}:${p.exerciseId}`)).size;
  const protein = mean(defined(days.filter((k) => an.aggs[k].mealsLogged > 0).map((k) => an.aggs[k].nutrition.total.protein)));
  const dec = (v: number | null) => (v == null ? undefined : v <= 0 ? C.green : C.blue);

  /* ---- consistency ---- */
  const scored = days.filter((k) => an.scores[k]?.score != null);
  const sc = (k: string) => an.scores[k].score!;
  const lo = scored.length ? Math.min(50, Math.floor(Math.min(...scored.map(sc)) / 10) * 10) : 50;
  const idx = (k: string) => an.cdays.indexOf(k) + 1;
  const weeks: { s: string; e: string; avg: number }[] = [];
  for (let i = 0; i < an.cdays.length; i += 7) {
    const ks = an.cdays.slice(i, i + 7).filter((k) => scored.includes(k));
    if (ks.length) weeks.push({ s: ks[0], e: ks.at(-1)!, avg: mean(ks.map(sc))! });
  }
  const bestWeek = weeks.length ? weeks.reduce((m, w) => (w.avg > m.avg ? w : m)) : null;
  const lowDay = scored.length ? scored.reduce((m, k) => (sc(k) < sc(m) ? k : m)) : null;
  const avgScore = mean(scored.map(sc));

  /* ---- compare ---- */
  const mx = METRICS.find((m) => m.id === xId)!, my = METRICS.find((m) => m.id === yId)!;
  const pairs = buildPairs(days, an.aggs, an.scores, mx, my, next);
  const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));

  /* ---- records ---- */
  const sets = d.workouts.flatMap((w) => w.sets.filter(isWork).map((s) => ({ s, w })));
  const heavy = sets.length ? sets.reduce((m, o) => (o.s.weightKg > m.s.weightKg || (o.s.weightKg === m.s.weightKg && o.s.reps > m.s.reps) ? o : m)) : null;
  const best = <T,>(f: (k: string) => number | null | undefined) => { let k0: string | null = null, v0 = -Infinity; for (const k of days) { const v = f(k); if (v != null && v > v0) { v0 = v; k0 = k; } } return k0 ? { k: k0, v: v0 } : null; };
  const hp = best((k) => (an.aggs[k].mealsLogged ? an.aggs[k].nutrition.total.protein : null));
  const hw = best((k) => an.aggs[k].nutrition.waterMl || null);
  const hs = best((k) => an.aggs[k].steps);
  const ls = d.sleeps.filter((s) => s.kind === 'night' && s.end).sort((a, b) => (b.durationMin ?? 0) - (a.durationMin ?? 0))[0];
  const hv = best((k) => an.aggs[k].volumeKg || null);

  const rec = (label: string, value: string, to?: string) => (
    <button key={label} type="button" className="rowline" style={{ justifyContent: 'space-between' }} disabled={!to} onClick={() => to && nav(to)}>
      <span>{label}</span><span className="num b600">{value}</span>
    </button>
  );

  return (
    <>
      <section aria-label="Summary" className="grid3">
        <Tile label="Sessions" value={String(done)} unit={expected ? `/${expected}` : undefined} />
        <Tile label="Weight" value={wDelta == null ? '—' : signed(wDelta)} unit="kg" color={dec(wDelta)} />
        <Tile label="Waist" value={waistDelta == null ? '—' : signed(waistDelta)} unit="cm" color={dec(waistDelta)} />
        <Tile label="PRs" value={String(prCount)} color={C.yellow} />
        <Tile label="Avg protein" value={protein == null ? '—' : fmtInt(protein)} unit="g" />
        <Tile label="Streak" value={String(an.streak)} unit="d" />
      </section>

      <StatCard title="Consistency Health" right={avgScore != null ? `avg ${Math.round(avgScore)}` : undefined}>
        {scored.length === 0 ? <div className="muted t-13">No scored days yet</div> : (
          <LineChart yLabels xDomain={[1, Math.max(2, an.cdays.length)]} yDomain={[lo, 100]} yTicks={[lo, Math.round((lo + 100) / 2), 100]} aria="Daily consistency score across the challenge" onOpenDay={(k) => nav(`/day/${k}`)}
            series={[{ color: C.green, lastDot: true, points: scored.map((k) => ({ x: idx(k), y: sc(k), dayKey: k, tip: `Day ${idx(k)} · ${Math.round(sc(k))}` })) }]} />
        )}
        <CellGrid cols={12} gap={4} radius={4} cells={an.cdays.map((k, i) => ({
          key: k, aria: `Day ${i + 1}${an.scores[k]?.score != null && k <= an.today ? ` score ${Math.round(an.scores[k].score!)}` : ''}`, bg: k > an.today ? 'rgba(255,255,255,0.06)' : greenCell(an.scores[k]?.score ?? null),
          outline: k === an.today ? '#F5F5F7' : undefined, onClick: k <= an.today ? () => nav(`/day/${k}`) : undefined,
        }))} />
        <div className="num t-13 muted">{bestWeek ? `Best week: ${fmtDay(bestWeek.s, 'd MMM')}–${fmtDay(bestWeek.e, 'd MMM')} (avg ${Math.round(bestWeek.avg)})` : ''}{lowDay ? ` · lowest day: Day ${idx(lowDay)} (${Math.round(sc(lowDay))})` : ''}</div>
      </StatCard>

      <StatCard title="Compare" right={<Btn sm onClick={() => setPick(true)}>{mx.label} × {my.label}<Icon name="down" size={14} sw={2.4} /></Btn>}>
        {pairs.length < 3 ? <div className="muted t-13">Needs at least 3 days with both values logged{next ? ' (Y taken from the next day)' : ''}. Found {pairs.length}.</div> : (
          <Scatter points={pairs.map((p) => ({ x: p.x, y: p.y, key: p.key, tip: `${fmtDay(p.key, 'EEE d MMM')} · ${fmt1(p.x)} ${mx.unit} → ${fmt1(p.y)} ${my.unit}` }))} color={C.purple}
            xLabel={`${mx.label}${mx.unit ? ` (${mx.unit})` : ''}`} yLabel={`${my.label}${next ? ' next day' : ''}`} aria={`Scatter of ${mx.label} against ${my.label}`} onOpenDay={(k) => nav(`/day/${k}`)} line />
        )}
        <div className="num t-13 muted">{r != null ? `r = ${r.toFixed(2)} · n = ${pairs.length}` : `n = ${pairs.length}`}</div>
        <div className="t-13 muted">Pick any two things you log.</div>
      </StatCard>

      <Card lg className="flat">
        <h2 className="t-card" style={{ marginBottom: 8 }}>Records</h2>
        {heavy ? rec('Heaviest lift', `${exName(d.exercises, heavy.s.exerciseId)} ${fmt1(heavy.s.weightKg)} kg × ${heavy.s.reps}`, `/day/${heavy.w.dayKey}`) : rec('Heaviest lift', '—')}
        {hp ? rec('Highest protein day', `${fmtMacro(hp.v)} g · ${fmtDay(hp.k, 'd MMM')}`, `/day/${hp.k}`) : rec('Highest protein day', '—')}
        {hw ? rec('Most water', `${fmtInt(hw.v)} ml · ${fmtDay(hw.k, 'd MMM')}`, `/day/${hw.k}`) : rec('Most water', '—')}
        {ls ? rec('Longest sleep', `${fmtDuration(ls.durationMin ?? 0)} · ${fmtDay(dayKeyOf(ls.end!, ls.endTzOffsetMin ?? ls.tzOffsetMin), 'd MMM')}`, `/day/${dayKeyOf(ls.end!, ls.endTzOffsetMin ?? ls.tzOffsetMin)}`) : rec('Longest sleep', '—')}
        {hs && rec('Most steps', `${fmtInt(hs.v)} · ${fmtDay(hs.k, 'd MMM')}`, `/day/${hs.k}`)}
        {hv && rec('Largest session volume', `${fmtInt(hv.v)} kg · ${fmtDay(hv.k, 'd MMM')}`, `/day/${hv.k}`)}
        {bestWeek ? rec('Best consistency week', `${fmtDay(bestWeek.s, 'd MMM')}–${fmtDay(bestWeek.e, 'd MMM')} · ${Math.round(bestWeek.avg)}`) : rec('Best consistency week', '—')}
        <button type="button" className="link" onClick={() => nav('/train/prs')}>PR wall ›</button>
      </Card>

      <Sheet open={pick} onClose={() => setPick(false)} title="Compare" tall closeLabel="Done">
        <div className="cap">X axis</div>
        <div className="row wrap g8">{METRICS.map((m) => <Chip key={m.id} sm on={xId === m.id} onClick={() => setX(m.id)}>{m.label}</Chip>)}</div>
        <div className="cap">Y axis</div>
        <div className="row wrap g8">{METRICS.map((m) => <Chip key={m.id} sm on={yId === m.id} onClick={() => setY(m.id)}>{m.label}</Chip>)}</div>
        <div className="toggle-row"><span>Y = next day</span><Switch checked={next} onChange={setNext} label="Y is the next day" /></div>
        <Legend items={[[`${mx.label} (X)`, C.purple], [`${my.label} (Y)`, C.purple]]} />
      </Sheet>
    </>
  );
}
