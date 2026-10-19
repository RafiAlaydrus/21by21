import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Btn, Card, Cap, Glows, IconBtn, Ring, SegBar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { useAnalysis } from '../../hooks/useAnalysis';
import { useLogger } from '../../hooks/useLogger';
import { useNow } from '../../hooks/useNow';
import { db } from '../../db/schema';
import { setMeta } from '../../db/ops';
import { logSupplement } from '../../db/actions';
import { stillToLog } from '../../logic/todo';
import type { TodoItem } from '../../logic/todo';
import { labelFor } from '../../logic/score';
import { macroSplit } from '../../logic/nutrition';
import { addDays, challengeLength, dayKey as dayKeyOf, daysLeft, daysUntilStart, diffDays, fmtTime, weekStart } from '../../logic/dates';
import { fmtDay, fmtDayLong, fmtDayWd, fmtDuration, fmtInt, fmtMacro, fmt1, signed } from '../../logic/format';
import { prCountForWorkout } from '../../logic/prs';
import { workoutHasWork, workoutMinutes } from '../../logic/aggregate';
import { mean } from '../../logic/stats';
import { LineChart } from '../../charts/LineChart';
import { BarChart } from '../../charts/BarChart';
import { CellGrid, greenCell } from '../../charts/bits';
import { C } from '../../theme';

const GLOWS = [
  { color: C.green, top: -60, left: -90, size: 320, opacity: 0.22, blur: 90 },
  { color: C.blue, top: 560, right: -120, size: 300, opacity: 0.2 },
  { color: C.purple, top: 1280, left: -100, size: 280, opacity: 0.16 },
];

export default function Today() {
  const nav = useNavigate();
  const toast = useToast();
  const { open } = useLogger();
  const d = useData();
  const an = useAnalysis();
  const now = useNow(30000);
  const { settings, today } = d;
  const c = settings.challenge;
  const a = an.aggs[today];
  const len = challengeLength(c);
  const before = an.phase === 'before' || an.phase === 'baseline';
  const complete = an.phase === 'complete';
  const label = labelFor(an.head.current, settings.score.labels);

  /* ---------- header text ---------- */
  const eyebrow = before
    ? an.phase === 'baseline' ? 'Day 0 · baseline' : (() => { const n = daysUntilStart(today, c); return n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`; })()
    : complete ? 'Challenge complete' : `Day ${an.dayNo} of ${len}${an.dayNo === len ? ' · final day' : ''}`;

  /* ---------- backup notice ---------- */
  const last = settings.lastBackupAt;
  const hasData = d.meals.length + d.workouts.length + d.weighIns.length + d.drinks.length > 0;
  const dueDays = settings.backupReminderDays;
  const lateBy = last ? Math.floor((now - last) / 86400000) : null;
  const showBackup = dueDays > 0 && hasData && d.meta.backupBannerDismissed !== today && (last ? now - last > dueDays * 86400000 : true);

  /* ---------- still to log ---------- */
  const hasMeas = d.measurements.some((m) => m.dayKey === today);
  const hasPhotos = d.progressPhotos.some((p) => p.dayKey === today);
  const todo = useMemo(() => stillToLog(a, settings, d.supplements, { hasMeasurement: hasMeas, hasPhotos }), [a, settings, d.supplements, hasMeas, hasPhotos]);

  const doTodo = async (t: TodoItem) => {
    switch (t.kind) {
      case 'water': return nav('/water');
      case 'meal': return nav(`/log/meal?label=${encodeURIComponent(t.mealLabel ?? '')}`);
      case 'supplement': {
        const s = d.supplements.find((x) => x.id === t.supplementId); if (!s) return;
        const rec = await logSupplement(s);
        return toast(`${s.name} ${fmt1(rec.amount)} ${rec.unit} logged`, { undo: () => void db.supplementLogs.delete(rec.id) });
      }
      case 'training': return open('startSession');
      case 'checkin': return open('checkin');
      case 'weighin': return open('weighin');
      case 'measurements': return open('measurements');
      case 'photos': return open('photo');
      case 'steps': return open('steps');
      case 'custom': return open('custom', { trackerId: t.trackerId });
    }
  };

  /* ---------- tiles ---------- */
  const ws = weekStart(today);
  const weekCount = d.workouts.filter((w) => w.dayKey >= ws && w.dayKey <= addDays(ws, 6) && workoutHasWork(w)).length;
  const gpw = settings.targets.gymPerWeek;
  const nextWeigh = c.weighInDates.filter((k) => k >= today && !(k === today && a.weighIn)).sort()[0];

  /* ---------- coming up ---------- */
  const upcoming = useMemo(() => {
    type Up = { key: string; sort: number; top: string; bottom: string; text: string; tag?: string; right?: string };
    const out: Up[] = [];
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    if (settings.trackers.reminders) for (const r of d.reminders) if (!r.done && r.at >= startToday.getTime()) {
      const k = d.today === dayKeyOf(r.at, r.tzOffsetMin) ? 'today' : fmtDay(dayKeyOf(r.at, r.tzOffsetMin), 'EEE d');
      out.push({ key: r.id, sort: r.at, top: fmtTime(r.at, r.tzOffsetMin), bottom: k, text: r.text, tag: 'REMINDER' });
    }
    const dates = new Set([...c.weighInDates, ...c.measurementDates, ...c.progressPhotoDates]);
    for (const k of [...dates].filter((x) => x > today)) {
      const parts = [c.weighInDates.includes(k) && 'weigh-in', c.measurementDates.includes(k) && 'measurements', c.progressPhotoDates.includes(k) && 'photos'].filter(Boolean) as string[];
      const text = (k === c.endDate ? 'Final ' : '') + parts.join(' + ');
      out.push({ key: `d${k}`, sort: Date.parse(k), top: fmtDay(k, 'EEE'), bottom: fmtDay(k, 'd MMM'), text: text.charAt(0).toUpperCase() + text.slice(1), right: `${diffDays(today, k)} d` });
    }
    if (c.recapDate > today) out.push({ key: 'recap', sort: Date.parse(c.recapDate), top: fmtDay(c.recapDate, 'EEE'), bottom: fmtDay(c.recapDate, 'd MMM'), text: 'Recap unlocks', right: `${diffDays(today, c.recapDate)} d` });
    return out.sort((x, y) => x.sort - y.sort).slice(0, 5);
  }, [d.reminders, d.today, c, today, settings.trackers.reminders]);

  /* ---------- consistency rings ---------- */
  const rings = useMemo(() => {
    const by = an.head.byCat;
    const avg = (cats: string[]) => mean(cats.map((k) => by[k as keyof typeof by]).filter((v): v is number => v != null));
    const defs: { key: string; label: string; v: number | null; color: string; to: string }[] = [
      { key: 'train', label: 'Train', v: avg(['training']), color: C.red, to: '/stats?tab=train' },
      { key: 'food', label: 'Food', v: avg(['food', 'calories', 'protein', 'carbs', 'fat']), color: C.orange, to: '/stats?tab=food' },
      { key: 'water', label: 'Water', v: avg(['water']), color: C.blue, to: '/stats?tab=food' },
      { key: 'sleep', label: 'Sleep', v: avg(['sleep']), color: C.purple, to: '/stats?tab=sleep' },
      { key: 'supps', label: 'Supps', v: avg(['supplements']), color: C.cyan, to: '/stats?tab=food' },
      { key: 'checkin', label: 'Check-in', v: avg(['checkin']), color: C.yellow, to: '/stats' },
      { key: 'steps', label: 'Steps', v: avg(['steps']), color: C.green, to: '/stats' },
      ...settings.customTrackers.map((t) => ({ key: t.id, label: t.name, v: avg([`custom:${t.id}`]), color: C.cyan, to: '/stats' })),
    ];
    return defs.filter((x) => x.v != null) as { key: string; label: string; v: number; color: string; to: string }[];
  }, [an.head.byCat, settings.customTrackers]);

  /* ---------- progress numbers ---------- */
  const n = a.nutrition.total;
  const tg = settings.targets;
  const split = macroSplit(n);
  const todayWorkouts = a.workouts.filter(workoutHasWork);
  const lastNight = [...d.sleeps].filter((s) => s.kind === 'night' && s.end).sort((x, y) => y.end! - x.end!)[0];
  const naps = a.sleeps.filter((s) => s.kind === 'nap' && s.end);
  const lastSupp = [...a.supplementLogs].sort((x, y) => y.time - x.time)[0];
  const usable = (t: { enabled: boolean; value: number }) => t.enabled && t.value > 0;

  /* ---------- graphs ---------- */
  const cdays = an.cdays.filter((k) => k <= today);
  const scorePts = cdays.map((k, i) => ({ x: i + 1, y: an.scores[k]?.score ?? null, dayKey: k, tip: an.scores[k]?.score != null ? `Day ${i + 1} · ${Math.round(an.scores[k].score!)}` : undefined }));
  const sc = scorePts.filter((p) => p.y != null);
  const bestScore = sc.length ? sc.reduce((m, p) => (p.y! > m.y! ? p : m)) : null;
  const weigh = [...d.weighIns].sort((x, y) => x.dayKey.localeCompare(y.dayKey));
  const wx = (k: string) => diffDays(c.baselineDate, k);
  const wMin = weigh.length ? Math.min(...weigh.map((w) => w.kg)) : 0, wMax = weigh.length ? Math.max(...weigh.map((w) => w.kg)) : 1;
  const wLast = weigh.at(-1);
  const sched = [...new Set(c.weighInDates)].filter((k) => !weigh.some((w) => w.dayKey === k) && k > (wLast?.dayKey ?? '')).sort();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter((k) => an.aggs[k]);
  const kcalMax = usable(tg.calories) ? tg.calories.value * 1.25 : Math.max(500, ...last7.map((k) => an.aggs[k].nutrition.total.kcal));
  const protMax = usable(tg.protein) ? tg.protein.value * 1.25 : Math.max(50, ...last7.map((k) => an.aggs[k].nutrition.total.protein));
  const waterMax = usable(tg.water) ? tg.water.value * 1.25 : Math.max(1000, ...last7.map((k) => an.aggs[k].nutrition.waterMl));

  const gcard = (title: string, right: string, children: React.ReactNode, onClick: () => void) => (
    <button type="button" className="glass card" style={{ flex: '0 0 290px', borderRadius: 22, padding: 16, gap: 10, textAlign: 'left' }} onClick={onClick}>
      <div className="row between baseline"><div className="t-15 b600">{title}</div><div className="num t-13 muted">{right}</div></div>
      {children}
    </button>
  );

  /* ---------- calendar ---------- */
  const cells = an.cdays.map((k, i) => {
    const s = an.scores[k]?.score ?? null;
    const future = k > today, isToday = k === today;
    return {
      key: k, aria: `Day ${i + 1}, ${fmtDayWd(k)}${s != null && !future ? `, score ${Math.round(s)}` : ''}`, text: i + 1,
      bg: future ? 'rgba(255,255,255,0.06)' : isToday ? 'transparent' : greenCell(an.aggs[k]?.anyLog ? s : null),
      color: future ? C.text2 : isToday ? C.green : s != null && s > 75 ? '#000' : '#fff', outline: isToday ? C.green : undefined,
      onClick: future && k !== today ? undefined : () => nav(`/day/${k}`),
    };
  });

  const baselineStatus = [
    { label: 'Weigh-in', done: d.weighIns.some((w) => w.dayKey === c.baselineDate), go: () => open('weighin', { dayKey: c.baselineDate }) },
    { label: 'Measurements', done: d.measurements.some((m) => m.dayKey === c.baselineDate), go: () => open('measurements', { dayKey: c.baselineDate }) },
    { label: 'Progress photos', done: (['front', 'side', 'back'] as const).every((p) => d.progressPhotos.some((x) => x.dayKey === c.baselineDate && x.pose === p)), go: () => open('photo', { dayKey: c.baselineDate }) },
  ];

  return (
    <div className="screen fade-in">
      <Glows list={GLOWS} />
      <header className="hdr-big">
        <div className="stack g2">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="t-large">Today</h1>
          <div className="t-15 muted">{fmtDayLong(today)}</div>
        </div>
        <div className="row g8"><IconBtn icon="search" label="Search" onClick={() => nav('/search')} /><IconBtn icon="gear" label="Settings" onClick={() => nav('/settings')} /></div>
      </header>

      {showBackup && (
        <div className="glass banner" role="status">
          <span className="t-13">{last ? `Last backup ${lateBy} day${lateBy === 1 ? '' : 's'} ago` : 'No backup yet'}</span>
          <span className="row g8"><Btn sm onClick={() => nav('/settings?s=backup')}>Back up</Btn><button type="button" className="icon-btn sm" aria-label="Dismiss" onClick={() => void setMeta('backupBannerDismissed', today)}><Icon name="x" size={16} /></button></span>
        </div>
      )}

      {complete && (
        <Card lg>
          <h2 className="t-card">Challenge complete</h2>
          <div className="t-13 muted">{c.recapDate <= today ? 'The recap is ready.' : `The recap opens ${fmtDayWd(c.recapDate)}.`}</div>
          <Btn block tint={C.green} tintA={0.45} disabled={c.recapDate > today} onClick={() => nav('/recap')}>Open recap</Btn>
        </Card>
      )}

      {before && (
        <Card lg aria-label="Baseline checklist">
          <div className="row between baseline"><h2 className="t-sec">Baseline</h2><span className="t-13 muted">{fmtDayWd(c.baselineDate)}</span></div>
          {baselineStatus.map((b) => (
            <button key={b.label} type="button" className="glass-btn row between" style={{ borderRadius: 18, padding: '12px 14px', minHeight: 48 }} onClick={b.go}>
              <span className="t-15 b600">{b.label}</span>
              <span className="row g6 t-13 muted">{b.done ? <><Icon name="check" size={16} color={C.green} />Logged</> : 'Log'}</span>
            </button>
          ))}
        </Card>
      )}

      {!before && (
        <Card lg aria-label="Consistency Health">
          <div className="row g20" style={{ gap: 18 }}>
            <Ring size={132} r={56} stroke={12} value={(an.head.current ?? 0) / 100} color={C.green} label={`Consistency ${an.head.current != null ? Math.round(an.head.current) : 'none'} out of 100, last 7 days`}>
              <div className="num" style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>{an.head.current != null ? Math.round(an.head.current) : '—'}</div>
              <div className="t-12 muted" style={{ marginTop: 4 }}>7-day</div>
            </Ring>
            <div className="stack g8" style={{ minWidth: 0 }}>
              <div className="cap" style={{ textTransform: 'none', fontSize: 13 }}>CONSISTENCY HEALTH</div>
              {label && <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3 }}>{label}</div>}
              <div className="row wrap g8">
                {an.head.today != null && <span className="glass-btn num b600" style={{ borderRadius: 999, padding: '5px 10px', fontSize: 13 }}>Today {Math.round(an.head.today)}</span>}
                {an.head.delta != null && <span className="glass-btn num b600" style={{ borderRadius: 999, padding: '5px 10px', fontSize: 13, color: an.head.delta >= 0 ? C.green : C.text3 }}>{an.head.delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(an.head.delta))} vs last wk</span>}
              </div>
              <div className="num t-13 muted">{complete ? `Ended ${fmtDayWd(c.endDate)}` : daysLeft(today, c) === 0 ? `Last day · ends today` : `${daysLeft(today, c)} day${daysLeft(today, c) === 1 ? '' : 's'} left · ends ${fmtDayWd(c.endDate)}`}</div>
            </div>
          </div>
          {rings.length > 0 && (
            <div className="grid5">
              {rings.map((r) => (
                <button key={r.key} type="button" className="stack col-center g6" aria-label={`${r.label} ${Math.round(r.v)}`} onClick={() => nav(r.to)}>
                  <Ring size={48} r={20} stroke={5} value={r.v / 100} color={r.color}><span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(r.v)}</span></Ring>
                  <span className="t-12 muted clip" style={{ maxWidth: '100%' }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card lg aria-label="What's next">
        <div className="row between baseline"><h2 className="t-sec">What's next</h2><div className="num t-13 muted">{todo.length === 0 ? 'All logged today' : `${todo.length} left today`}</div></div>
        <Cap>Still to log today</Cap>
        <div className="stack g8">
          {todo.length === 0 && <div className="muted t-15">All logged today</div>}
          {todo.map((t) => (
            <button key={t.id} type="button" className="glass-btn" style={{ borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', minHeight: 44 }} onClick={() => void doTodo(t)}>
              {t.progress ? (
                <>
                  <span className="row between t-15 b600" style={{ width: '100%' }}><span>{t.label}</span><span className="num" style={{ color: t.color }}>{fmtInt(t.progress.value)} / {fmtInt(t.progress.target)} {t.progress.unit}</span></span>
                  <Bar value={t.progress.value / t.progress.target} color={t.color} style={{ width: '100%' }} />
                </>
              ) : (
                <span className="row between" style={{ width: '100%' }}>
                  <span className="row g10 t-15 b600"><span className="dot" style={{ background: t.color }} />{t.label}</span>
                  <span className="t-13 muted">{t.hint}</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="sep" />
        <div className="grid2">
          <button type="button" className="glass-btn stack g6" style={{ borderRadius: 18, padding: 14, textAlign: 'left' }} onClick={() => nav('/train')}>
            <Cap>Gym this week</Cap>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{weekCount}{gpw.enabled && <span className="t-17 muted"> / {gpw.value}</span>}</div>
            {gpw.enabled && <SegBar done={Math.min(weekCount, gpw.value)} total={Math.max(1, Math.round(gpw.value))} color={C.red} />}
          </button>
          <button type="button" className="glass-btn stack g6" style={{ borderRadius: 18, padding: 14, textAlign: 'left' }} onClick={() => open('weighin')}>
            <Cap>Next weigh-in</Cap>
            {nextWeigh ? <><div className="t-card">{fmtDayWd(nextWeigh)}</div><div className="num t-13 muted">{nextWeigh === today ? 'today' : `in ${diffDays(today, nextWeigh)} day${diffDays(today, nextWeigh) === 1 ? '' : 's'}`}</div></> : <div className="t-card muted">None scheduled</div>}
          </button>
        </div>
        <Cap>Coming up</Cap>
        <div className="stack">
          {upcoming.length === 0 && <div className="muted t-15">Nothing scheduled</div>}
          {upcoming.map((u) => (
            <button key={u.key} type="button" className="rowline" style={{ padding: '10px 0' }} onClick={() => u.tag && open('reminder', { id: u.key })}>
              <span className="num t-12 muted ta-center" style={{ width: 44, lineHeight: 1.2 }}>{u.top}<br />{u.bottom}</span>
              <span className="grow t-15" style={{ textAlign: 'left' }}>{u.text}</span>
              {u.tag ? <span className="t-11 b600" style={{ color: C.yellow }}>{u.tag}</span> : <span className="num t-13 muted">{u.right}</span>}
            </button>
          ))}
        </div>
        {settings.trackers.reminders && <Btn style={{ alignSelf: 'flex-start' }} onClick={() => open('reminder')}>+ Add reminder</Btn>}
      </Card>

      <section aria-label="Today's progress" className="stack g10">
        <h2 className="t-sec" style={{ margin: '4px 4px 0' }}>Progress</h2>
        <div className="grid2">
          <Card tile><div className="t-12 b600" style={{ color: C.orange }}>CALORIES</div><div className="big-num num">{fmtInt(n.kcal)}</div>
            {usable(tg.calories) ? <><div className="num t-13 muted">{tg.calories.direction === 'atMost' ? 'up to' : tg.calories.direction === 'range' ? `${fmtInt(tg.calories.value)}–${fmtInt(tg.calories.rangeMax ?? tg.calories.value)}, now` : 'of'} {tg.calories.direction === 'range' ? '' : fmtInt(tg.calories.value)} kcal</div><Bar value={n.kcal / (tg.calories.rangeMax ?? tg.calories.value)} color={C.orange} /></> : <div className="num t-13 muted">kcal</div>}</Card>
          <Card tile><div className="t-12 b600" style={{ color: C.green }}>PROTEIN</div><div className="big-num num">{fmtMacro(n.protein)} g</div>
            {usable(tg.protein) ? <><div className="num t-13 muted">of {fmtInt(tg.protein.value)} g</div><Bar value={n.protein / tg.protein.value} color={C.green} /></> : <div className="num t-13 muted">total</div>}</Card>
        </div>
        <Card tile>
          <div className="row between t-12 b600 muted"><span>MACROS TODAY</span><span className="num">P {fmtMacro(n.protein)} · C {fmtMacro(n.carbs)} · F {fmtMacro(n.fat)}</span></div>
          <div className="macro-bar" role="img" aria-label={`Protein ${split.p}%, carbs ${split.c}%, fat ${split.f}%`}>
            {n.kcal > 0 ? <><div style={{ width: `${split.p}%`, background: C.green }} /><div style={{ width: `${split.c}%`, background: C.orange }} /><div style={{ width: `${split.f}%`, background: C.yellow }} /></> : <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)' }} />}
          </div>
          <div className="row g14 t-12 muted" style={{ gap: 14 }}>
            {([['Protein', split.p, C.green], ['Carbs', split.c, C.orange], ['Fat', split.f, C.yellow]] as const).map(([l, v, col]) => <span key={l} className="row g6"><span style={{ width: 8, height: 8, borderRadius: 2, background: col }} />{l} {v}%</span>)}
          </div>
        </Card>
        <div className="grid2">
          <Card tile><div className="t-12 b600" style={{ color: C.red }}>GYM{todayWorkouts[0]?.title ? ` · ${todayWorkouts[0].title.toUpperCase()}` : ''}</div>
            {todayWorkouts.length ? <>
              <div className="num t-card">{todayWorkouts[0].checkOut ? fmtDuration(workoutMinutes(todayWorkouts[0])) : 'In progress'}</div>
              <div className="num t-13 muted">{fmtInt(a.volumeKg)} kg volume</div>
              {prCountForWorkout(an.prs, todayWorkouts[0].id) > 0 && <div className="t-13 b600" style={{ color: C.yellow }}>{prCountForWorkout(an.prs, todayWorkouts[0].id)} new PR{prCountForWorkout(an.prs, todayWorkouts[0].id) > 1 ? 's' : ''}</div>}
            </> : <><div className="t-card muted">—</div><div className="t-13 muted">No session today</div></>}
          </Card>
          {settings.trackers.sleep && <Card tile><div className="t-12 b600" style={{ color: C.purple }}>SLEEP · LAST NIGHT</div>
            {lastNight ? <>
              <div className="num t-card">{fmtDuration(lastNight.durationMin ?? 0)}</div>
              <div className="num t-13 muted">{fmtTime(lastNight.start, lastNight.tzOffsetMin)} → {fmtTime(lastNight.end!, lastNight.endTzOffsetMin ?? lastNight.tzOffsetMin)}</div>
            </> : <><div className="t-card muted">—</div><div className="t-13 muted">Not logged</div></>}
            <div className="t-13 muted">{naps.length ? `Nap ${fmtDuration(a.napMin)}` : 'No nap yet'}</div>
          </Card>}
        </div>
        {settings.trackers.supplements && (
          <Card tile className="row between" style={{ flexDirection: 'row' }}>
            <div className="stack g2"><div className="t-12 b600" style={{ color: C.cyan }}>SUPPLEMENTS</div><div className="t-15">{lastSupp ? `${lastSupp.name} ${fmt1(lastSupp.amount)} ${lastSupp.unit} · ${fmtTime(lastSupp.time, lastSupp.tzOffsetMin)}` : 'None logged'}</div></div>
            <div className="num t-card">{a.supplementLogs.length}{a.suppDailyTotal > 0 && <span className="t-15 muted"> / {a.suppDailyTotal}</span>}</div>
          </Card>
        )}
        {settings.trackers.water && (
          <button type="button" className="glass card tile" style={{ textAlign: 'left' }} onClick={() => nav('/water')}>
            <div className="row between"><div className="t-12 b600" style={{ color: C.blue }}>WATER</div><div className="num t-13 muted">{usable(tg.water) ? `${fmtInt(a.nutrition.waterMl)} / ${fmtInt(tg.water.value)} ml` : `${fmtInt(a.nutrition.waterMl)} ml`}</div></div>
            {usable(tg.water) && <Bar value={a.nutrition.waterMl / tg.water.value} color={C.blue} />}
          </button>
        )}
        <div className="grid2">
          {settings.trackers.steps && <Card tile><div className="t-12 b600" style={{ color: C.green }}>STEPS</div><div className="big-num num">{a.steps != null ? fmtInt(a.steps) : '—'}</div>{usable(tg.steps) && <div className="num t-13 muted">of {fmtInt(tg.steps.value)}</div>}</Card>}
          {settings.customTrackers.map((t) => (
            <button key={t.id} type="button" className="glass card tile" style={{ textAlign: 'left' }} onClick={() => open('custom', { trackerId: t.id })}>
              <div className="t-12 b600" style={{ color: C.cyan }}>{t.name.toUpperCase()}</div>
              <div className="big-num num">{a.custom[t.id] === undefined ? '—' : t.kind === 'boolean' ? (a.custom[t.id] ? 'Yes' : 'No') : `${a.custom[t.id]}${t.unit ? ` ${t.unit}` : ''}`}</div>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Graphs" className="stack g10">
        <div className="row between baseline" style={{ margin: '4px 4px 0' }}><h2 className="t-sec">Graphs</h2><button type="button" className="link" onClick={() => nav('/stats')}>See all</button></div>
        <div className="hscroll">
          {gcard('Consistency', cdays.length ? `Day 1–${cdays.length}` : 'No days yet',
            <LineChart w={258} h={110} xDomain={[1, Math.max(2, cdays.length)]} yDomain={[0, 100]} yTicks={[0, 50, 100]} aria={`Daily consistency score, days 1 to ${cdays.length}`}
              series={[{ color: C.green, points: scorePts, lastDot: true }]} onOpenDay={(k) => nav(`/day/${k}`)} />,
            () => nav('/stats'))}
          {gcard('Weight', weigh.length > 1 ? `${signed(weigh.at(-1)!.kg - weigh[0].kg)} kg` : 'Weigh-ins',
            <>
              <LineChart w={258} h={110} xDomain={[0, Math.max(1, diffDays(c.baselineDate, c.endDate))]} yDomain={[wMin - 1, wMax + 1]} yTicks={[]} aria="Weight on weigh-in dates"
                series={[
                  { color: C.text, dots: true, labels: true, points: weigh.map((w) => ({ x: wx(w.dayKey), y: w.kg, label: fmt1(w.kg), dayKey: w.dayKey, tip: `${fmt1(w.kg)} kg · ${fmtDay(w.dayKey, 'd MMM')}` })) },
                  { color: C.text, points: sched.map((k) => ({ x: wx(k), y: wLast?.kg ?? null, hollow: true })) },
                ]} onOpenDay={(k) => nav(`/day/${k}`)} />
              <div className="row between t-11 muted">{[...new Set(c.weighInDates)].sort().map((k) => <span key={k}>{fmtDay(k, 'd MMM')}</span>)}</div>
            </>, () => nav('/stats?tab=body'))}
          {gcard('Calories & protein', '7 days',
            <>
              <BarChart w={258} h={110} aria="Calories and protein, last 7 days" targetFrac={usable(tg.calories) ? Math.min(1, tg.calories.value / kcalMax) : undefined} targetColor="rgba(255,159,10,0.6)" barMax={14}
                groups={last7.map((k) => ({ key: k, dayKey: k, tip: `${fmtDay(k, 'EEE d')} · ${fmtInt(an.aggs[k].nutrition.total.kcal)} kcal · P ${fmtMacro(an.aggs[k].nutrition.total.protein)} g`, items: [{ v: an.aggs[k].nutrition.total.kcal, color: C.orange, max: kcalMax }, { v: an.aggs[k].nutrition.total.protein, color: C.green, max: protMax }] }))}
                onOpenDay={(k) => nav(`/day/${k}`)} />
              <div className="row g14 t-12 muted" style={{ gap: 14 }}><span>Kcal (orange)</span><span>Protein (green)</span>{usable(tg.calories) && <span>Target line</span>}</div>
            </>, () => nav('/stats?tab=food'))}
          {gcard('Water & sleep', '7 days',
            <>
              <BarChart w={258} h={110} aria="Water and sleep, last 7 days" barMax={20}
                groups={last7.map((k) => ({ key: k, dayKey: k, dim: k === today, tip: `${fmtDay(k, 'EEE d')} · ${fmtInt(an.aggs[k].nutrition.waterMl)} ml${an.aggs[k].nightMin != null ? ` · sleep ${fmtDuration(an.aggs[k].nightMin!)}` : ''}`, items: [{ v: an.aggs[k].nutrition.waterMl, color: C.blue, max: waterMax }] }))}
                line={{ color: C.purple, max: Math.max(10, ...last7.map((k) => (an.aggs[k].nightMin ?? 0) / 60)), values: last7.map((k) => (an.aggs[k].nightMin != null ? an.aggs[k].nightMin! / 60 : null)) }}
                onOpenDay={(k) => nav(`/day/${k}`)} />
              <div className="row g14 t-12 muted" style={{ gap: 14 }}><span>Water (bars)</span><span>Sleep hrs (line)</span></div>
            </>, () => nav('/stats?tab=sleep'))}
        </div>
      </section>

      <Card lg aria-label="Today's timeline">
        <h2 className="t-sec">Timeline</h2>
        <Timeline day={today} empty="Nothing logged yet today" />
      </Card>

      <Card lg aria-label="Challenge calendar">
        <div className="row between baseline"><h2 className="t-sec">{len} days</h2><div className="t-13 muted">{fmtDay(c.startDate, 'd MMM')} – {fmtDay(c.endDate, 'd MMM')}</div></div>
        <CellGrid cols={6} cells={cells} />
      </Card>
    </div>
  );
}
