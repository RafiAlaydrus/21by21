import { useNavigate } from 'react-router-dom';
import { BarChart } from '../../charts/BarChart';
import { LineChart } from '../../charts/LineChart';
import { Scatter } from '../../charts/Scatter';
import { useData } from '../../hooks/useData';
import type { Analysis } from '../../hooks/useAnalysis';
import { dayKey as dayKeyOf, minutesOfDay } from '../../logic/dates';
import { buildPairs, defined, mean, METRICS, pearson, sleepClock } from '../../logic/stats';
import { fmt1, fmtDay, fmtDuration, fmtMinOfDay } from '../../logic/format';
import { Legend, Mini, StatCard, pastDays } from './common';
import { C } from '../../theme';

export function SleepStats({ an }: { an: Analysis }) {
  const nav = useNavigate();
  const d = useData();
  const days = pastDays(an);
  const A = (k: string) => an.aggs[k];
  const nights = days.filter((k) => A(k).nightMin != null);
  const avgNight = mean(nights.map((k) => A(k).nightMin!));
  const napDays = days.filter((k) => A(k).napMin > 0);
  const naps = d.sleeps.filter((s) => s.kind === 'nap' && s.end).length;
  const clock = sleepClock(d.sleeps);
  const maxMin = Math.max(600, ...days.map((k) => (A(k).nightMin ?? 0) + A(k).napMin));
  const lab = (k: string, i: number) => (i % 3 === 0 ? fmtDay(k, 'd/M') : '');
  const idx = (k: string) => an.cdays.indexOf(k) + 1;

  // bedtimes after 12:00 are plotted as minus 24 h so they sit next to the early-morning ones
  const bed = d.sleeps.filter((s) => s.kind === 'night' && s.end).sort((a, b) => a.start - b.start).map((s) => { const m = minutesOfDay(s.start, s.tzOffsetMin); return { k: s.dayKey, v: m >= 720 ? m - 1440 : m }; });
  const wake = d.sleeps.filter((s) => s.kind === 'night' && s.end).sort((a, b) => a.start - b.start).map((s) => ({ k: dayKeyOf(s.end!, s.endTzOffsetMin ?? s.tzOffsetMin), v: minutesOfDay(s.end!, s.endTzOffsetMin ?? s.tzOffsetMin) }));
  const range = (vs: number[]) => { const lo = Math.min(...vs), hi = Math.max(...vs); return [Math.floor((lo - 20) / 30) * 30, Math.ceil((hi + 20) / 30) * 30] as [number, number]; };

  const clockChart = (title: string, pts: { k: string; v: number }[], color: string, st: { mean: number; sd: number } | null) => (
    <StatCard title={title} right={st ? `${fmtMinOfDay(st.mean)} ± ${Math.round(st.sd)} min` : undefined}>
      {pts.length < 2 ? <div className="muted t-13">Needs at least 2 nights</div> : (() => {
        const [lo, hi] = range(pts.map((p) => p.v));
        return <LineChart yLabels xDomain={[1, Math.max(2, an.cdays.length)]} yDomain={[lo, hi]} yTicks={[lo, Math.round((lo + hi) / 2), hi]} fmtTick={fmtMinOfDay} aria={`${title} per night`} onOpenDay={(k) => nav(`/day/${k}`)}
          target={st?.mean} targetColor="rgba(255,255,255,0.3)" series={[{ color, dots: true, points: pts.map((p) => ({ x: idx(p.k) || 1, y: p.v, dayKey: p.k, tip: `${fmtMinOfDay(p.v)} · ${fmtDay(p.k, 'd MMM')}` })) }]} />;
      })()}
    </StatCard>
  );

  const m = (id: string) => METRICS.find((x) => x.id === id)!;
  const pairs = buildPairs(days, an.aggs, an.scores, m('sleep'), m('energy'), true);
  const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));

  return (
    <>
      <StatCard title="Sleep" right={`${avgNight != null ? `avg ${fmtDuration(avgNight)}` : '—'} · ${naps} nap${naps === 1 ? '' : 's'}`}>
        {nights.length === 0 && days.length > 0 ? <div className="muted t-13">No night sleep logged</div> : (
          <BarChart mode="stack" aria="Night sleep and naps per day" yMax={maxMin} barMax={14} onOpenDay={(k) => nav(`/day/${k}`)}
            groups={days.map((k, i) => ({ key: k, dayKey: k, label: lab(k, i), tip: `${fmtDay(k, 'EEE d MMM')} · night ${A(k).nightMin != null ? fmtDuration(A(k).nightMin!) : '—'}${A(k).napMin ? ` · nap ${fmtDuration(A(k).napMin)}` : ''}`, items: [{ v: A(k).nightMin ?? 0, color: C.purple }, { v: A(k).napMin, color: C.purpleLight }] }))} />
        )}
        <Legend items={[['Night', C.purple], ['Nap', C.purpleLight]]} />
        <div className="grid3">
          <Mini label="Avg night" value={avgNight != null ? fmtDuration(avgNight) : '—'} />
          <Mini label="Naps" value={`${napDays.length} d`} />
          <Mini label="Avg total" value={defined(days.map((k) => (A(k).nightMin != null ? A(k).nightMin! + A(k).napMin : null))).length ? fmtDuration(mean(defined(days.map((k) => (A(k).nightMin != null ? A(k).nightMin! + A(k).napMin : null))))!) : '—'} />
        </div>
        <div className="grid2">
          <div className="stack g2"><div className="t-11 b600 muted">AVG BEDTIME</div><div className="num t-15">{clock.bed ? <>{fmtMinOfDay(clock.bed.mean)} <span className="muted">± {Math.round(clock.bed.sd)} min</span></> : '—'}</div></div>
          <div className="stack g2"><div className="t-11 b600 muted">AVG WAKE</div><div className="num t-15">{clock.wake ? <>{fmtMinOfDay(clock.wake.mean)} <span className="muted">± {Math.round(clock.wake.sd)} min</span></> : '—'}</div></div>
        </div>
      </StatCard>

      {clockChart('Bedtime', bed, C.purple, clock.bed)}
      {clockChart('Wake time', wake, C.purpleLight, clock.wake)}

      <StatCard title="Sleep × next-day energy">
        {pairs.length < 3 ? <div className="muted t-13">Needs at least 3 nights with the next day's check-in. Found {pairs.length}.</div> : (
          <Scatter points={pairs.map((p) => ({ x: Math.round(p.x * 10) / 10, y: p.y, key: p.key, tip: `${fmt1(p.x)} h → energy ${p.y} · ${fmtDay(p.key, 'd MMM')}` }))} color={C.purple} xLabel="Sleep (hours)" yLabel="Next-day energy" aria="Sleep hours against next-day energy" onOpenDay={(k) => nav(`/day/${k}`)} line />
        )}
        <div className="num t-13 muted">{r != null ? `r = ${r.toFixed(2)} · ` : ''}n = {pairs.length}</div>
      </StatCard>
    </>
  );
}
