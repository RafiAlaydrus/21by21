import { Card, Page } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { computePRs } from '../../logic/prs';
import { fmtDayLong } from '../../logic/format';
import { SessionRow } from './bits';
import { C } from '../../theme';

export default function History() {
  const { workouts, gyms } = useData();
  const prs = computePRs(workouts);
  const days = [...new Set(workouts.map((w) => w.dayKey))].sort().reverse();
  return (
    <Page title="History" sub={`${workouts.length} session${workouts.length === 1 ? '' : 's'}`} glows={[{ color: C.red, top: -40, right: -100, opacity: 0.18 }]}>
      {days.length === 0 && <div className="empty"><div className="b600">No sessions yet</div></div>}
      {days.map((d) => (
        <section key={d} className="stack g8">
          <h2 className="cap" style={{ padding: '0 4px' }}>{fmtDayLong(d)}</h2>
          <Card className="flat" style={{ padding: '4px 16px' }}>
            {workouts.filter((w) => w.dayKey === d).sort((a, b) => a.checkIn - b.checkIn).map((w) => <SessionRow key={w.id} w={w} prs={prs} gyms={gyms} />)}
          </Card>
        </section>
      ))}
    </Page>
  );
}
