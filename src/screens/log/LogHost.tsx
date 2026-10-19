import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoggerCtx } from '../../hooks/useLogger';
import type { LogKind, LogProps, LoggerApi, LoggerProps } from '../../hooks/useLogger';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { useData } from '../../hooks/useData';
import { C, rgba } from '../../theme';

type Lazy = LazyExoticComponent<ComponentType<LoggerProps>>;
const REG: Partial<Record<LogKind, Lazy>> = {
  sleep: lazy(() => import('../sleep/SleepLogger')),
  drink: lazy(() => import('./DrinkLogger')),
  supplement: lazy(() => import('./SupplementLogger')),
  startSession: lazy(() => import('../train/StartSession')),
  cardio: lazy(() => import('../train/CardioLogger')),
  craving: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.CravingLogger }))),
  checkin: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.CheckinLogger }))),
  weighin: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.WeighInLogger }))),
  steps: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.StepsLogger }))),
  tag: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.TagLogger }))),
  note: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.NoteLogger }))),
  reminder: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.ReminderLogger }))),
  custom: lazy(() => import('./MiscLoggers').then((m) => ({ default: m.CustomLogger }))),
  measurements: lazy(() => import('./MeasurementsLogger')),
  soreness: lazy(() => import('./SorenessLogger')),
  photo: lazy(() => import('./PhotoLogger')),
};

interface Tile { id: string; label: string; icon: string; color: string; show: boolean; go: (() => void) | { kind: LogKind; props?: LogProps } }

export function LogHost({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { settings, workouts } = useData();
  const [quickOpen, setQuickOpen] = useState(false);
  const [dayKey, setDayKey] = useState<string | undefined>();
  const [active, setActive] = useState<{ kind: LogKind; props: LogProps } | null>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => { setOpen(false); setQuickOpen(false); window.setTimeout(() => setActive(null), 320); }, []);
  const openKind = useCallback((kind: LogKind, props: LogProps = {}) => {
    setQuickOpen(false); setActive({ kind, props }); setOpen(true);
  }, []);
  const api = useMemo<LoggerApi>(() => ({
    quick: (d) => { setDayKey(d); setQuickOpen(true); },
    open: openKind,
    close,
  }), [openKind, close]);

  const tr = settings.trackers;
  const day = dayKey ? `?day=${dayKey}` : '';
  const activeWorkout = workouts.some((w) => !w.checkOut);
  const tiles: Tile[] = [
    { id: 'meal', label: 'Meal', icon: 'eat', color: C.orange, show: tr.food, go: () => nav(`/log/meal${day}`) },
    { id: 'water', label: 'Water', icon: 'drop', color: C.blue, show: tr.water, go: () => nav(`/water${day}`) },
    { id: 'drink', label: 'Drink', icon: 'cup', color: C.blue, show: tr.drinks, go: { kind: 'drink' } },
    { id: 'supplement', label: 'Supplement', icon: 'pill', color: C.cyan, show: tr.supplements, go: { kind: 'supplement' } },
    { id: 'workout', label: 'Workout', icon: 'train', color: C.red, show: tr.training, go: activeWorkout ? () => nav('/train/session') : { kind: 'startSession' } },
    { id: 'cardio', label: 'Cardio', icon: 'run', color: C.red, show: tr.training, go: { kind: 'cardio' } },
    { id: 'sleep', label: 'Sleep', icon: 'moon', color: C.purple, show: tr.sleep, go: { kind: 'sleep' } },
    { id: 'craving', label: 'Craving', icon: 'zap', color: C.red, show: tr.cravings, go: { kind: 'craving' } },
    { id: 'checkin', label: 'Check-in', icon: 'smile', color: C.yellow, show: tr.checkin, go: { kind: 'checkin' } },
    { id: 'weighin', label: 'Weigh-in', icon: 'scale', color: C.text, show: true, go: { kind: 'weighin' } },
    { id: 'measurements', label: 'Measurements', icon: 'ruler', color: C.text, show: true, go: { kind: 'measurements' } },
    { id: 'photo', label: 'Progress photo', icon: 'camera', color: C.text, show: true, go: { kind: 'photo' } },
    { id: 'soreness', label: 'Soreness', icon: 'body', color: C.red, show: tr.soreness, go: { kind: 'soreness' } },
    { id: 'steps', label: 'Steps', icon: 'steps', color: C.green, show: tr.steps, go: { kind: 'steps' } },
    { id: 'tag', label: 'Tag day', icon: 'tag', color: C.purpleLight, show: tr.tags, go: { kind: 'tag' } },
    { id: 'note', label: 'Note', icon: 'note', color: C.text3, show: true, go: { kind: 'note' } },
    { id: 'reminder', label: 'Reminder', icon: 'bell', color: C.yellow, show: tr.reminders, go: { kind: 'reminder' } },
    ...settings.customTrackers.map<Tile>((t) => ({ id: `c:${t.id}`, label: t.name, icon: 'plus', color: C.cyan, show: true, go: { kind: 'custom', props: { trackerId: t.id } } })),
  ];

  const Active = active ? REG[active.kind] : undefined;
  return (
    <LoggerCtx.Provider value={api}>
      {children}
      <Sheet open={quickOpen} onClose={close} title="Log" closeLabel="Close">
        <div className="quick-grid">
          {tiles.filter((t) => t.show).map((t) => (
            <button key={t.id} type="button" className="glass-btn quick-tile" onClick={() => {
              if (typeof t.go === 'function') { close(); t.go(); } else openKind(t.go.kind, { dayKey, ...t.go.props });
            }}>
              <span style={{ width: 40, height: 40, borderRadius: 20, background: rgba(t.color === C.text ? '#FFFFFF' : t.color, 0.18), display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color }}>
                <Icon name={t.icon} size={22} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </Sheet>
      {Active && active && (
        <Suspense fallback={null}><Active open={open} onClose={close} {...active.props} /></Suspense>
      )}
    </LoggerCtx.Provider>
  );
}
