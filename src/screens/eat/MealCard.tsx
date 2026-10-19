import { useNavigate } from 'react-router-dom';
import { useBlobUrl } from '../../db/photos';
import { mealN, exactPct } from '../../logic/nutrition';
import { fmtTime } from '../../logic/dates';
import { fmtInt, fmtMacro } from '../../logic/format';
import { C } from '../../theme';
import type { Meal } from '../../db/types';

/** One meal as a glass card: photo, label, mode badge, kcal, P/C/F, clean, ≈ when estimated. */
export function MealCard({ meal }: { meal: Meal }) {
  const nav = useNavigate();
  const url = useBlobUrl(meal.photoId, 'thumb');
  const n = mealN(meal);
  const est = meal.mode === 'bought' || exactPct(meal.items) < 100;
  const a = est ? '≈ ' : '';
  return (
    <button type="button" className="glass card tile row" style={{ textAlign: 'left', gap: 12, padding: 12 }} onClick={() => nav(`/eat/meal/${meal.id}`)}>
      <div className="photo-ph" style={{ width: 72, height: 72, borderRadius: 14, flexShrink: 0 }}>{url ? <img src={url} alt="" /> : <span>Meal<br />photo</span>}</div>
      <div className="stack g4 grow">
        <div className="row g8"><span className="t-17 b600">{meal.label}</span>
          <span className="tag l" style={{ background: 'rgba(255,159,10,0.2)', color: C.orange }}>{meal.mode}</span>
          {meal.clean && <span className="tag l" style={{ background: 'rgba(48,209,88,0.2)', color: C.green }}>clean</span>}
        </div>
        <div className="num t-17 b700">{a}{fmtInt(n.kcal)} <span className="t-13 muted b600">kcal</span></div>
        <div className="num t-13 muted">{fmtTime(meal.time, meal.tzOffsetMin)} · P {a}{fmtMacro(n.protein)} · C {a}{fmtMacro(n.carbs)} · F {a}{fmtMacro(n.fat)}{meal.editedLate && <span className="edited-late">edited later</span>}</div>
      </div>
    </button>
  );
}
