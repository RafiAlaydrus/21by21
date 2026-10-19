import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { useBlobUrl } from '../../db/photos';
import { fmtDayLong } from '../../logic/format';
import { C } from '../../theme';
import type { Meal } from '../../db/types';

function Thumb({ meal }: { meal: Meal }) {
  const nav = useNavigate();
  const url = useBlobUrl(meal.photoId, 'thumb');
  return (
    <button type="button" className="photo-ph" style={{ aspectRatio: '1', borderRadius: 14, position: 'relative' }} aria-label={`${meal.label} photo`} onClick={() => nav(`/eat/meal/${meal.id}`)}>
      {url && <img src={url} alt="" />}
      <span className="tag" style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{meal.label}</span>
    </button>
  );
}

export default function Gallery() {
  const { meals } = useData();
  const days = [...new Set(meals.map((m) => m.dayKey))].sort().reverse();
  return (
    <Page title="Food gallery" sub={`${meals.length} meal${meals.length === 1 ? '' : 's'}`} glows={[{ color: C.orange, top: -40, right: -100, opacity: 0.2 }]}>
      {days.length === 0 && <div className="empty"><div className="b600">No meal photos yet</div></div>}
      {days.map((d) => (
        <section key={d} className="stack g8">
          <h2 className="cap" style={{ padding: '0 4px' }}>{fmtDayLong(d)}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {meals.filter((m) => m.dayKey === d).sort((a, b) => a.time - b.time).map((m) => <Thumb key={m.id} meal={m} />)}
          </div>
        </section>
      ))}
    </Page>
  );
}
