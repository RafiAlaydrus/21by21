import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Page, TextField } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { useLogger } from '../../hooks/useLogger';
import { searchAll } from '../../logic/search';
import type { SearchHit, SearchKind } from '../../logic/search';
import { fmtDayWd } from '../../logic/format';

const GROUPS: [SearchKind, string][] = [['meal', 'Meals'], ['food', 'Foods'], ['recipe', 'Recipes'], ['exercise', 'Exercises'], ['workout', 'Workouts'], ['craving', 'Cravings'], ['note', 'Day notes'], ['tag', 'Tags'], ['reminder', 'Reminders'], ['checkin', 'Check-in notes']];

export default function Search() {
  const nav = useNavigate();
  const d = useData();
  const { open } = useLogger();
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchAll(q, d), [q, d]);

  const go = (h: SearchHit) => {
    switch (h.kind) {
      case 'meal': return nav(`/eat/meal/${h.id}`);
      case 'food': return nav('/eat/library');
      case 'recipe': return nav('/eat/library?tab=recipes');
      case 'exercise': return nav(`/train/exercise/${h.id}`);
      case 'workout': return nav(`/train/session/${h.id}`);
      case 'reminder': return open('reminder', { id: h.id });
      default: return h.dayKey && nav(`/day/${h.dayKey}`);
    }
  };

  return (
    <Page title="Search" noTabs glows={[{ color: C_BLUE, top: -40, right: -100, opacity: 0.16 }]}>
      <TextField label="Search everything you logged" value={q} onChange={setQ} placeholder="Meal, place, exercise, note…" autoFocus />
      {q.trim() && hits.length === 0 && <div className="empty"><div className="b600">No results</div></div>}
      {GROUPS.map(([kind, title]) => {
        const list = hits.filter((h) => h.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="stack g8">
            <h2 className="cap" style={{ padding: '0 4px' }}>{title} · {list.length}</h2>
            <Card className="flat" style={{ padding: '4px 16px' }}>
              {list.slice(0, 30).map((h) => (
                <button key={`${h.kind}${h.id}`} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => go(h)}>
                  <span className="stack g2 grow"><span className="b600 clip">{h.title}</span>{h.sub && <span className="t-12 muted clip">{h.sub}</span>}</span>
                  {h.dayKey && <span className="num t-12 muted">{fmtDayWd(h.dayKey)}</span>}
                </button>
              ))}
            </Card>
          </section>
        );
      })}
    </Page>
  );
}
const C_BLUE = '#0A84FF';
