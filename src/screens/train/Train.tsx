import { useNavigate } from 'react-router-dom';
import { Btn, Card, Cap, Glows, IconBtn, SegBar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useData } from '../../hooks/useData';
import { useLogger } from '../../hooks/useLogger';
import { useNow } from '../../hooks/useNow';
import { computePRs } from '../../logic/prs';
import { addDays, weekStart } from '../../logic/dates';
import { fmtClock, fmtDayLong, fmtInt } from '../../logic/format';
import { workoutHasWork, workoutVolume } from '../../logic/aggregate';
import { SessionRow } from './bits';
import { C } from '../../theme';

export default function Train() {
  const nav = useNavigate();
  const { open } = useLogger();
  const { workouts, gyms, exercises, settings, today } = useData();
  const prs = computePRs(workouts);
  const active = [...workouts].filter((w) => !w.checkOut).sort((a, b) => b.checkIn - a.checkIn)[0];
  const now = useNow(active ? 1000 : 60000); // the 1 s tick only drives the live session timer
  const todays = workouts.filter((w) => w.dayKey === today && w.checkOut);
  const ws = weekStart(today), we = addDays(ws, 6);
  const weekCount = workouts.filter((w) => w.dayKey >= ws && w.dayKey <= we && workoutHasWork(w)).length;
  const t = settings.targets.gymPerWeek;
  const recent = [...workouts].sort((a, b) => b.checkIn - a.checkIn).slice(0, 5);
  const gym = gyms.find((g) => g.id === active?.gymId)?.name;

  const link = (icon: string, label: string, sub: string, to: string, color = C.red) => (
    <button type="button" className="glass-btn row g12" style={{ borderRadius: 18, padding: '12px 14px', minHeight: 60, textAlign: 'left' }} onClick={() => nav(to)}>
      <span style={{ width: 38, height: 38, borderRadius: 19, background: `${color}2e`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></span>
      <span className="stack g2 grow"><span className="b600">{label}</span><span className="t-12 muted">{sub}</span></span>
      <span className="muted t-17">›</span>
    </button>
  );

  return (
    <div className="screen fade-in">
      <Glows list={[{ color: C.red, top: -40, left: -100, size: 320, opacity: 0.2 }]} />
      <header className="hdr-big">
        <div className="stack g2"><div className="eyebrow" style={{ color: C.red }}>{fmtDayLong(today)}</div><h1 className="t-large">Train</h1></div>
        <IconBtn icon="search" label="Search" onClick={() => nav('/search')} />
      </header>

      <Card lg aria-label="Today's session">
        <Cap color={C.red}>Today's session</Cap>
        {active ? (
          <>
            <div className="row between baseline"><div className="t-card">{active.title || 'Workout'}</div><span className="num xl-num" style={{ fontSize: 30 }}>{fmtClock((now - active.checkIn) / 1000)}</span></div>
            <div className="t-13 muted">{gym ?? 'No gym selected'} · {active.sets.filter((s) => s.doneAt).length} sets done</div>
            <Btn block tint={C.red} tintA={0.4} onClick={() => nav('/train/session')}>Open session</Btn>
          </>
        ) : (
          <>
            {todays.length > 0 && todays.map((w) => <SessionRow key={w.id} w={w} prs={prs} gyms={gyms} />)}
            <Btn block tint={C.red} tintA={0.4} onClick={() => open('startSession')}>Start session</Btn>
          </>
        )}
      </Card>

      <div className="grid2">
        <Card tile>
          <Cap>Gym this week</Cap>
          <div className="big-num num">{weekCount}{t.enabled && <span className="t-17 muted"> / {t.value}</span>}</div>
          {t.enabled && <SegBar done={Math.min(weekCount, t.value)} total={Math.max(1, Math.round(t.value))} color={C.red} />}
        </Card>
        <Card tile>
          <Cap>This week volume</Cap>
          <div className="big-num num">{fmtInt(workouts.filter((w) => w.dayKey >= ws && w.dayKey <= we).reduce((a, w) => a + workoutVolume(w), 0))}</div>
          <div className="t-13 muted">kg</div>
        </Card>
      </div>

      <section className="stack g8">
        <h2 className="t-sec" style={{ margin: '4px 4px 0' }}>Recent</h2>
        <Card className="flat" style={{ padding: '4px 16px' }}>
          {recent.length === 0 && <div className="muted" style={{ padding: '14px 0' }}>No sessions logged</div>}
          {recent.map((w) => <SessionRow key={w.id} w={w} prs={prs} gyms={gyms} />)}
        </Card>
      </section>

      <section className="stack g10">
        {link('list', 'History', `${workouts.length} session${workouts.length === 1 ? '' : 's'}`, '/train/history')}
        {link('train', 'Exercises', `${exercises.length} in your library`, '/train/exercises')}
        {link('trophy', 'PR wall', `${new Set(prs.map((p) => `${p.workoutId}:${p.exerciseId}`)).size} records`, '/train/prs', C.yellow)}
        {link('pin', 'Gyms', `${gyms.length} saved`, '/train/gyms', C.cyan)}
      </section>
    </div>
  );
}
