import { useNavigate } from 'react-router-dom';
import { BarChart } from '../../charts/BarChart';
import { Scatter } from '../../charts/Scatter';
import { HBars } from '../../charts/bits';
import { useData } from '../../hooks/useData';
import type { Analysis } from '../../hooks/useAnalysis';
import { addDays, minutesOfDay } from '../../logic/dates';
import { cravingsByHour, defined, eatingWindowMin, mean, overnightGapMin, spendByCurrency, sum } from '../../logic/stats';
import { macroSplit, itemN, portionFactor } from '../../logic/nutrition';
import { fmt1, fmtDay, fmtDuration, fmtInt, fmtMacro, fmtMinOfDay, fmtMoney } from '../../logic/format';
import { Legend, Mini, StatCard, pastDays } from './common';
import { C } from '../../theme';

export function FoodStats({ an }: { an: Analysis }) {
  const nav = useNavigate();
  const d = useData();
  const tg = d.settings.targets;
  const days = pastDays(an);
  const fed = days.filter((k) => an.aggs[k].mealsLogged > 0);
  const A = (k: string) => an.aggs[k];
  const avg = (f: (k: string) => number) => { const m = mean(fed.map(f)); return m == null ? '—' : fmtInt(m); };
  const meals = days.flatMap((k) => A(k).meals);
  let tot = 0, exact = 0;
  for (const m of meals) { const f = portionFactor(m); for (const i of m.items) { const kc = itemN(i).kcal * f; tot += kc; if (!i.estimated) exact += kc; } }
  const exactPct = tot > 0 ? (exact / tot) * 100 : null;
  const sumMacro = { protein: sum(fed.map((k) => A(k).nutrition.total.protein)), carbs: sum(fed.map((k) => A(k).nutrition.total.carbs)), fat: sum(fed.map((k) => A(k).nutrition.total.fat)) };
  const split = macroSplit(sumMacro);
  const usable = (t: { enabled: boolean; value: number }) => t.enabled && t.value > 0;
  const kcalMax = Math.max(usable(tg.calories) ? (tg.calories.rangeMax ?? tg.calories.value) * 1.2 : 0, ...fed.map((k) => A(k).nutrition.total.kcal), 500);
  const protMax = Math.max(usable(tg.protein) ? tg.protein.value * 1.2 : 0, ...fed.map((k) => A(k).nutrition.total.protein), 50);
  const lab = (k: string, i: number) => (i % 3 === 0 ? fmtDay(k, 'd/M') : '');

  const windows = days.map((k, i) => ({ k, i, w: eatingWindowMin(A(k).meals) }));
  const gaps = days.map((k) => overnightGapMin(A(addDays(k, -1))?.meals ?? [], A(k).meals));
  const windowMax = Math.max(60, ...defined(windows.map((x) => x.w)));

  const spend = spendByCurrency(meals);
  const craves = days.flatMap((k) => A(k).cravings);
  const hours = cravingsByHour(craves);
  const buckets = Array.from({ length: 8 }, (_, i) => sum(hours.slice(i * 3, i * 3 + 3)));
  const bMax = Math.max(1, ...buckets);
  const resisted = craves.filter((c) => c.outcome === 'resisted').length;

  const waterMax = Math.max(usable(tg.water) ? tg.water.value * 1.2 : 0, ...days.map((k) => A(k).nutrition.waterMl), 1000);
  const drinkTot = new Map<string, { ml: number; kcal: number }>();
  for (const dr of d.drinks.filter((x) => x.dayKey >= d.settings.challenge.baselineDate)) {
    const name = dr.kind === 'water' ? 'Water' : d.drinkTypes.find((t) => t.id === dr.drinkTypeId)?.name ?? 'Other';
    const o = drinkTot.get(name) ?? { ml: 0, kcal: 0 };
    o.ml += dr.ml; o.kcal += (d.drinkTypes.find((t) => t.id === dr.drinkTypeId)?.per100ml?.kcal ?? 0) * dr.ml / 100;
    drinkTot.set(name, o);
  }
  const drinkRows = [...drinkTot].sort((a, b) => b[1].ml - a[1].ml);
  const dMax = Math.max(1, ...drinkRows.map((r) => r[1].ml));

  const mealPts = meals.map((m) => ({ x: an.cdays.indexOf(m.dayKey) + 1, y: Math.round((minutesOfDay(m.time, m.tzOffsetMin) / 60) * 10) / 10, key: m.dayKey, tip: `${m.label} · ${fmtMinOfDay(minutesOfDay(m.time, m.tzOffsetMin))}` })).filter((p) => p.x > 0);

  return (
    <>
      <StatCard title="Food" right={`${meals.length} meals · ${meals.length ? Math.round((meals.filter((m) => m.clean).length / meals.length) * 100) : 0}% clean`}>
        <div className="grid4" style={{ gap: 6 }}>
          <Mini label="Avg kcal" value={avg((k) => A(k).nutrition.total.kcal)} /><Mini label="Protein" value={avg((k) => A(k).nutrition.total.protein)} />
          <Mini label="Carbs" value={avg((k) => A(k).nutrition.total.carbs)} /><Mini label="Fat" value={avg((k) => A(k).nutrition.total.fat)} />
        </div>
        <div className="grid3"><Mini label="Exact" value={exactPct == null ? '—' : `${Math.round(exactPct)}%`} /><Mini label="Est. ≈" value={exactPct == null ? '—' : `${Math.round(100 - exactPct)}%`} /><Mini label="Days logged" value={String(fed.length)} /></div>
        <div className="macro-bar" role="img" aria-label={`Protein ${split.p}%, carbs ${split.c}%, fat ${split.f}%`}>
          {fed.length ? <><div style={{ width: `${split.p}%`, background: C.green }} /><div style={{ width: `${split.c}%`, background: C.orange }} /><div style={{ width: `${split.f}%`, background: C.yellow }} /></> : <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)' }} />}
        </div>
        <div className="row g14 t-12 muted" style={{ gap: 14 }}><span>Protein {split.p}%</span><span>Carbs {split.c}%</span><span>Fat {split.f}%</span></div>
      </StatCard>

      <StatCard title="Calories & protein per day">
        <BarChart aria="Daily calories and protein" targetFrac={usable(tg.calories) ? Math.min(1, (tg.calories.rangeMax ?? tg.calories.value) / kcalMax) : undefined} targetColor="rgba(255,159,10,0.6)" barMax={13} onOpenDay={(k) => nav(`/day/${k}`)}
          groups={days.map((k, i) => ({ key: k, dayKey: k, label: lab(k, i), tip: `${fmtDay(k, 'EEE d MMM')} · ${fmtInt(A(k).nutrition.total.kcal)} kcal · P ${fmtMacro(A(k).nutrition.total.protein)} g`, items: [{ v: A(k).nutrition.total.kcal, color: C.orange, max: kcalMax }, { v: A(k).nutrition.total.protein, color: C.green, max: protMax }] }))} />
        <Legend items={[['Kcal', C.orange], ['Protein', C.green], ...(usable(tg.calories) ? [['Calorie target', 'rgba(255,255,255,0.4)'] as [string, string]] : [])]} />
      </StatCard>

      <StatCard title="Macros per day" right="share of kcal">
        <BarChart mode="stack" aria="Daily macro calories, stacked" onOpenDay={(k) => nav(`/day/${k}`)}
          groups={days.map((k, i) => { const n = A(k).nutrition.total; return { key: k, dayKey: k, label: lab(k, i), tip: `${fmtDay(k, 'd MMM')} · P ${fmtMacro(n.protein)} / C ${fmtMacro(n.carbs)} / F ${fmtMacro(n.fat)} g`, items: [{ v: n.protein * 4, color: C.green }, { v: n.carbs * 4, color: C.orange }, { v: n.fat * 9, color: C.yellow }] }; })} />
        <Legend items={[['Protein', C.green], ['Carbs', C.orange], ['Fat', C.yellow]]} />
      </StatCard>

      <StatCard title="Eating window" right={mean(defined(windows.map((x) => x.w))) != null ? `avg ${fmtDuration(mean(defined(windows.map((x) => x.w)))!)}` : undefined}>
        <BarChart aria="Eating window per day, first to last meal" onOpenDay={(k) => nav(`/day/${k}`)}
          groups={windows.map((x) => ({ key: x.k, dayKey: x.k, label: lab(x.k, x.i), tip: x.w != null ? `${fmtDay(x.k, 'd MMM')} · ${fmtDuration(x.w)}` : `${fmtDay(x.k, 'd MMM')} · fewer than 2 meals`, items: [{ v: x.w ?? 0, color: C.orange, max: windowMax }] }))} />
        <div className="num t-13 muted">Overnight gap (last meal → first meal): {mean(defined(gaps)) != null ? `avg ${fmtDuration(mean(defined(gaps))!)}` : '—'}</div>
        <div className="cap">Meal timing</div>
        {mealPts.length < 2 ? <div className="muted t-13">Needs more meals</div> : <Scatter points={mealPts} color={C.orange} xLabel="Challenge day" yLabel="Hour" aria="Time of day of each meal" onOpenDay={(k) => nav(`/day/${k}`)} />}
      </StatCard>

      {d.settings.trackers.spending && <StatCard title="Spend" right="per currency, not converted">
        {Object.keys(spend).length === 0 && <div className="muted t-13">No prices or ingredient costs logged</div>}
        {Object.entries(spend).map(([cur, s]) => (
          <div key={cur} className="stack g6">
            <div className="row between"><span className="b600">{cur}</span><span className="num b700">{fmtMoney(s.total, cur)}</span></div>
            <div className="num t-13 muted">{fmtMoney(s.total / Math.max(1, days.length), cur)} per day · cooked {fmtMoney(s.cooked, cur)} ({Math.round((s.cooked / s.total) * 100)}%) · bought {fmtMoney(s.bought, cur)}</div>
            <div className="macro-bar"><div style={{ width: `${(s.cooked / s.total) * 100}%`, background: C.green }} /><div style={{ width: `${(s.bought / s.total) * 100}%`, background: C.orange }} /></div>
          </div>
        ))}
        {Object.keys(spend).length > 0 && <Legend items={[['Cooked', C.green], ['Bought', C.orange]]} />}
      </StatCard>}

      <StatCard title="Cravings by time of day" right={`${resisted} resisted · ${craves.length - resisted} ate`}>
        {craves.length === 0 ? <div className="muted t-13">No cravings logged</div> : (
          <>
            <div role="img" aria-label="Cravings by time of day" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 4, alignItems: 'end', height: 70 }}>
              {buckets.map((v, i) => <span key={i} style={{ height: `${Math.max(6, (v / bMax) * 100)}%`, borderRadius: 3, background: v === bMax ? C.red : 'rgba(255,55,95,0.6)' }} />)}
            </div>
            <div className="row between t-11 muted">{['0', '3', '6', '9', '12', '15', '18', '21'].map((h) => <span key={h}>{h}</span>)}</div>
          </>
        )}
      </StatCard>

      <StatCard title="Water per day" right="plain water only">
        <BarChart aria="Plain water per day" targetFrac={usable(tg.water) ? Math.min(1, tg.water.value / waterMax) : undefined} targetColor="rgba(10,132,255,0.7)" onOpenDay={(k) => nav(`/day/${k}`)}
          groups={days.map((k, i) => ({ key: k, dayKey: k, label: lab(k, i), tip: `${fmtDay(k, 'd MMM')} · ${fmtInt(A(k).nutrition.waterMl)} ml`, items: [{ v: A(k).nutrition.waterMl, color: C.blue, max: waterMax }] }))} />
        <div className="cap">Drinks</div>
        <HBars rows={drinkRows.map(([n, v]) => ({ label: n, pct: (v.ml / dMax) * 100, text: `${fmtInt(v.ml)} ml`, color: n === 'Water' ? C.blue : C.cyan }))} labelW={88} valueW={64} />
      </StatCard>

      <StatCard title="Supplements">
        {d.supplements.length === 0 && <div className="muted t-13">No supplements in the library</div>}
        {d.supplements.map((s) => {
          const logs = d.supplementLogs.filter((l) => l.supplementId === s.id && l.dayKey >= d.settings.challenge.baselineDate);
          const totalAmt = sum(logs.map((l) => l.amount));
          return (
            <div key={s.id} className="stack g6">
              <div className="row between t-15"><span className="b600">{s.name}</span><span className="num muted t-13">{fmt1(totalAmt)} {s.unit} total · {new Set(logs.map((l) => l.dayKey)).size} days</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, an.cdays.length)}, minmax(0, 1fr))`, gap: 2 }}>
                {an.cdays.map((k) => { const n = logs.filter((l) => l.dayKey === k).length; return <span key={k} title={`${fmtDay(k, 'd MMM')}: ${n}`} style={{ aspectRatio: '1', borderRadius: 3, background: k > an.today ? 'rgba(255,255,255,0.04)' : n ? C.cyan : 'rgba(255,255,255,0.1)' }} />; })}
              </div>
            </div>
          );
        })}
      </StatCard>
    </>
  );
}
