import { useNavigate } from 'react-router-dom';
import { Card, Page } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { computePRs, PR_LABEL } from '../../logic/prs';
import type { PREvent } from '../../logic/prs';
import { fmtDayLong, fmtInt, fmt1 } from '../../logic/format';
import { exName } from './bits';
import { C } from '../../theme';

export const prValue = (e: PREvent) =>
  e.type === 'weight' ? `${fmt1(e.value)} kg` : e.type === 'reps' ? `${e.value} reps${e.weightKg != null ? ` @ ${fmt1(e.weightKg)} kg` : ''}`
    : e.type === 'e1rm' ? `${fmt1(e.value)} kg` : `${fmtInt(e.value)} kg`;

export default function PRWall() {
  const nav = useNavigate();
  const { workouts, exercises } = useData();
  const prs = computePRs(workouts).sort((a, b) => b.time - a.time);
  const days = [...new Set(prs.map((p) => p.dayKey))];
  return (
    <Page title="PR wall" sub="From your own logged sets" glows={[{ color: C.yellow, top: -40, right: -100, opacity: 0.14 }]}>
      {prs.length === 0 && <div className="empty"><div className="b600">No records yet</div><div className="t-13 muted">A record needs an earlier session of the same exercise to beat.</div></div>}
      {days.map((d) => (
        <section key={d} className="stack g8">
          <h2 className="cap" style={{ padding: '0 4px' }}>{fmtDayLong(d)}</h2>
          <Card className="flat" style={{ padding: '4px 16px' }}>
            {prs.filter((p) => p.dayKey === d).map((p, i) => (
              <button key={i} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => nav(`/train/exercise/${p.exerciseId}`)}>
                <span className="stack g2 grow"><span className="b600">{exName(exercises, p.exerciseId)}</span><span className="t-12 muted">{PR_LABEL[p.type]} · was {p.type === 'reps' ? `${p.prev} reps` : `${fmtInt(p.prev)} kg`}</span></span>
                <span className="num b700" style={{ color: C.yellow }}>{prValue(p)}</span>
              </button>
            ))}
          </Card>
        </section>
      ))}
    </Page>
  );
}
