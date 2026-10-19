import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Card, Cap, Page, PhotoBox } from '../../components/ui';
import { SourceTag, StateTag } from '../../components/SourceTag';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { useBlobUrl } from '../../db/photos';
import { db } from '../../db/schema';
import { exactPct, itemN, mealN, portionFactor } from '../../logic/nutrition';
import { fmtTime } from '../../logic/dates';
import { fmtDayLong, fmtInt, fmtMacro, fmtMoney } from '../../logic/format';
import { C } from '../../theme';

export default function MealDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { meals } = useData();
  const m = meals.find((x) => x.id === id);
  const url = useBlobUrl(m?.photoId, 'full');
  if (!m) return <Page title="Meal" glows={[{ color: C.orange, top: -40, right: -100, opacity: 0.2 }]}><div className="empty"><div className="b600">Meal not found</div></div></Page>;
  const bought = m.mode === 'bought';
  const n = mealN(m);
  const ex = Math.round(exactPct(m.items));
  const a = bought || ex < 100 ? '≈ ' : '';
  const f = portionFactor(m);
  const del = async () => { await db.meals.delete(m.id); nav(-1); toast('Meal deleted', { undo: () => void db.meals.put(m) }); };

  return (
    <Page title={m.label} sub={`${fmtDayLong(m.dayKey)} · ${fmtTime(m.time, m.tzOffsetMin)}`} glows={[{ color: C.orange, top: -40, right: -100, opacity: 0.2 }]}
      right={<Btn sm onClick={() => nav(`/log/meal?edit=${m.id}`)}>Edit</Btn>}>
      <PhotoBox url={url} ratio="4 / 3" radius={24} label="Meal photo" />
      <Card>
        <div className="row between baseline"><Cap>{bought ? 'Bought' : 'Cooked'}{m.clean ? ' · clean' : ' · not clean'}</Cap><span className="t-12 b700" style={{ color: bought ? C.orange : ex === 100 ? C.green : C.orange }}>{bought ? '≈ ESTIMATED' : `${ex}% EXACT`}</span></div>
        <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>{a}{fmtInt(n.kcal)} <span className="t-17 muted b600">kcal</span></div>
        <div className="grid3">
          {([['Protein', n.protein, C.green], ['Carbs', n.carbs, C.orange], ['Fat', n.fat, C.yellow]] as const).map(([l, v, c]) => (
            <div key={l} className="glass-btn stack g2" style={{ borderRadius: 14, padding: 10 }}>
              <span className="t-11 b600" style={{ color: c, textTransform: 'uppercase' }}>{l}</span>
              <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{a}{fmtMacro(v)} g</span>
            </div>
          ))}
        </div>
        {!bought && m.wholeDishG && m.eatenG != null && <div className="t-13 muted num">Ate {fmtMacro(m.eatenG)} g of {fmtMacro(m.wholeDishG)} g ({Math.round(f * 100)}%)</div>}
        {m.place && <div className="t-13 muted">Where: {m.place}</div>}
        {m.price && <div className="t-13 muted num">Price: {fmtMoney(m.price.amount, m.price.currency)}</div>}
        {m.cost && <div className="t-13 muted num">Ingredient cost: {fmtMoney(m.cost.amount, m.cost.currency)}</div>}
        {!bought && (m.method || m.tool || m.cookTimeMin) && <div className="t-13 muted">{[m.method, m.tool, m.cookTimeMin ? `${m.cookTimeMin} min` : ''].filter(Boolean).join(' · ')}</div>}
      </Card>
      {m.items.length > 0 && (
        <Card className="flat" style={{ padding: '4px 16px' }}>
          {m.items.map((i) => {
            const t = itemN(i);
            return (
              <div key={i.id} className="rowline" style={{ justifyContent: 'space-between' }}>
                <div className="stack g2 grow">
                  <span className="b600">{i.name}{i.isSeasoning ? ' · seasoning' : ''}</span>
                  <span className="row wrap g6">{i.brand && <span className="t-12 muted">{i.brand}</span>}<StateTag state={i.state} /><SourceTag source={i.source} /></span>
                  <span className="num t-12 light">{i.estimated ? '≈ ' : ''}{fmtInt(t.kcal)} kcal · P {fmtMacro(t.protein)} · C {fmtMacro(t.carbs)} · F {fmtMacro(t.fat)}</span>
                  {i.note && <span className="t-12 muted" style={{ fontStyle: 'italic' }}>{i.note}</span>}
                </div>
                <span className="num b700">{i.estimated ? '≈ ' : ''}{fmtMacro(i.amount)} {i.basis}</span>
              </div>
            );
          })}
        </Card>
      )}
      {m.note && <Card><Cap>Note</Cap><div className="pre">{m.note}</div></Card>}
      <Btn className="danger" onClick={() => void del()}>Delete meal</Btn>
    </Page>
  );
}
