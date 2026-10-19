import { useNavigate, useSearchParams } from 'react-router-dom';
import { Glows, IconBtn, Segmented } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { useAnalysis } from '../../hooks/useAnalysis';
import { challengeLength } from '../../logic/dates';
import { fmtDay } from '../../logic/format';
import { Overview } from './Overview';
import { Body } from './Body';
import { TrainStats } from './TrainStats';
import { FoodStats } from './FoodStats';
import { SleepStats } from './SleepStats';
import { C } from '../../theme';

type Tab = 'overview' | 'body' | 'train' | 'food' | 'sleep';
const TABS: { value: Tab; label: string }[] = [{ value: 'overview', label: 'Overview' }, { value: 'body', label: 'Body' }, { value: 'train', label: 'Train' }, { value: 'food', label: 'Food' }, { value: 'sleep', label: 'Sleep' }];

export default function Stats() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.find((t) => t.value === sp.get('tab'))?.value ?? 'overview') as Tab;
  const { settings } = useData();
  const an = useAnalysis();
  const c = settings.challenge;
  const len = challengeLength(c);
  const eyebrow = an.phase === 'active' && an.dayNo ? `Day ${an.dayNo} of ${len}${an.dayNo === len ? ' · final day' : ''}` : an.phase === 'complete' ? 'Challenge complete' : 'Before the start';

  return (
    <div className="screen fade-in">
      <Glows list={[{ color: C.blue, top: -40, right: -100, size: 300, opacity: 0.2 }, { color: C.green, top: 760, left: -120, size: 300, opacity: 0.16 }, { color: C.purple, top: 1700, right: -120, size: 300, opacity: 0.16 }]} />
      <header className="hdr-big">
        <div className="stack g2"><div className="eyebrow">{eyebrow}</div><h1 className="t-large">Stats</h1><div className="t-15 muted">{fmtDay(c.startDate, 'd MMM')} – {fmtDay(c.endDate, 'd MMM')}</div></div>
        <div className="row g8">
          {an.phase === 'complete' && <IconBtn icon="trophy" label="Recap" onClick={() => nav('/recap')} />}
          <IconBtn icon="share" label="Export report" onClick={() => nav('/report')} />
        </div>
      </header>
      <Segmented value={tab} options={TABS} onChange={(t) => setSp({ tab: t }, { replace: true })} />
      {tab === 'overview' && <Overview an={an} />}
      {tab === 'body' && <Body an={an} />}
      {tab === 'train' && <TrainStats an={an} />}
      {tab === 'food' && <FoodStats an={an} />}
      {tab === 'sleep' && <SleepStats an={an} />}
    </div>
  );
}
