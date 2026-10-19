import { useNavigate } from 'react-router-dom';
import { Btn, Card, Cap, Glows, IconBtn } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useData } from '../../hooks/useData';
import { aggregateDays } from '../../logic/aggregate';
import { fmtDayLong, fmtInt, fmtMacro } from '../../logic/format';
import { MealCard } from './MealCard';
import { C } from '../../theme';

export default function Eat() {
  const nav = useNavigate();
  const data = useData();
  const { today, meals } = data;
  const a = aggregateDays(data, [today])[today];
  const list = meals.filter((m) => m.dayKey === today).sort((x, y) => x.time - y.time);
  const n = a.nutrition.total;
  const t = data.settings.targets;

  const link = (icon: string, label: string, sub: string, to: string, color: string) => (
    <button type="button" className="glass-btn row g12" style={{ borderRadius: 18, padding: '12px 14px', minHeight: 60, textAlign: 'left' }} onClick={() => nav(to)}>
      <span style={{ width: 38, height: 38, borderRadius: 19, background: `${color}2e`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></span>
      <span className="stack g2 grow"><span className="b600">{label}</span><span className="t-12 muted">{sub}</span></span>
      <span className="muted t-17">›</span>
    </button>
  );

  return (
    <div className="screen fade-in">
      <Glows list={[{ color: C.orange, top: -40, left: -100, size: 320, opacity: 0.2 }]} />
      <header className="hdr-big">
        <div className="stack g2"><div className="eyebrow" style={{ color: C.orange }}>{fmtDayLong(today)}</div><h1 className="t-large">Eat</h1></div>
        <IconBtn icon="search" label="Search" onClick={() => nav('/search')} />
      </header>

      <Card lg>
        <div className="row between baseline"><Cap>Today</Cap><span className="num t-13 muted">{list.length} meal{list.length === 1 ? '' : 's'}</span></div>
        <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>{fmtInt(n.kcal)} <span className="t-17 muted b600">kcal{t.calories.enabled && t.calories.value ? ` · target ${fmtInt(t.calories.value)}` : ''}</span></div>
        <div className="grid3">
          {([['Protein', n.protein, C.green], ['Carbs', n.carbs, C.orange], ['Fat', n.fat, C.yellow]] as const).map(([l, v, c]) => (
            <div key={l} className="glass-btn stack g2" style={{ borderRadius: 14, padding: 10 }}>
              <span className="t-11 b600" style={{ color: c, textTransform: 'uppercase' }}>{l}</span>
              <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{fmtMacro(v)} g</span>
            </div>
          ))}
        </div>
        {a.exactPct != null && <div className="t-13 muted num">{Math.round(a.exactPct)}% exact · {Math.round(100 - a.exactPct)}% estimated ≈</div>}
        {a.nutrition.notCounted.length > 0 && <div className="t-12 muted">{a.nutrition.notCounted.length} supplement log(s): nutrition not counted — unit differs</div>}
      </Card>

      <section aria-label="Today's meals" className="stack g10">
        {list.length === 0 && <div className="empty"><div className="b600">No meals logged today</div></div>}
        {list.map((m) => <MealCard key={m.id} meal={m} />)}
        <Btn block tint={C.orange} tintA={0.32} onClick={() => nav('/log/meal')}>+ Log meal</Btn>
      </section>

      <section className="stack g10">
        {data.settings.trackers.water && link('drop', 'Water & drinks', `${fmtInt(a.nutrition.waterMl)} ml water${a.nutrition.otherMl ? ` · ${fmtInt(a.nutrition.otherMl)} ml other drinks` : ''}`, '/water', C.blue)}
        {link('grid', 'Food gallery', 'All meal photos by day', '/eat/gallery', C.orange)}
        {link('library', 'Library', 'Foods, recipes, drinks, supplements', '/eat/library', C.cyan)}
      </section>
    </div>
  );
}
